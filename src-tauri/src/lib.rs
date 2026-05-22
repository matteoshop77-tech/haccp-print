// ─── HACCPrint · lib.rs ────────────────────────────────────────────────────
#[cfg(target_os = "windows")]
mod win_print {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use std::ptr::null_mut;
    use winapi::um::winspool::*;
    use winapi::um::winnt::HANDLE;
    use winapi::shared::minwindef::*;

    fn to_wide(s: &str) -> Vec<u16> {
        OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
    }

    pub fn list_printers() -> Vec<String> {
        use winapi::um::errhandlingapi::GetLastError;
        use winapi::shared::winerror::ERROR_INSUFFICIENT_BUFFER;

        // Pattern Win32: prima call con buffer NULL fallisce con
        // ERROR_INSUFFICIENT_BUFFER e popola `needed`. Seconda call (con buffer
        // allocato) può fallire di nuovo se la lista cresce nel frattempo —
        // retry fino a 3 tentativi per gestire la race.
        let mut buf: Vec<u8> = Vec::new();
        let mut needed: DWORD = 0;
        let mut returned: DWORD = 0;
        let mut success = false;

        for attempt in 0..3 {
            let buf_size = buf.len() as DWORD;
            let buf_ptr = if buf.is_empty() {
                std::ptr::null_mut()
            } else {
                buf.as_mut_ptr()
            };

            let ok = unsafe {
                EnumPrintersW(
                    PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS,
                    std::ptr::null_mut(),
                    4,
                    buf_ptr,
                    buf_size,
                    &mut needed,
                    &mut returned,
                )
            };

            if ok != 0 {
                success = true;
                break;
            }

            let err = unsafe { GetLastError() };
            if err != ERROR_INSUFFICIENT_BUFFER {
                eprintln!("EnumPrintersW failed at attempt {}: error 0x{:X}", attempt + 1, err);
                return vec![];
            }
            if needed == 0 {
                // Driver dice "ho bisogno di più buffer" ma needed=0: scenario
                // anomalo, evito loop infinito.
                return vec![];
            }
            buf.resize(needed as usize, 0);
        }

        if !success {
            eprintln!("EnumPrintersW: lista cresciuta in modo continuativo, esauriti i 3 tentativi.");
            return vec![];
        }

        let mut names = vec![];
        let struct_size = std::mem::size_of::<PRINTER_INFO_4W>();
        for i in 0..returned as usize {
            let base = i * struct_size;
            if base + struct_size > buf.len() { break; }
            let info = unsafe { &*(buf.as_ptr().add(base) as *const PRINTER_INFO_4W) };
            if info.pPrinterName.is_null() { continue; }
            let name = unsafe {
                let mut len = 0;
                while *info.pPrinterName.add(len) != 0 { len += 1; }
                String::from_utf16_lossy(std::slice::from_raw_parts(info.pPrinterName, len))
            };
            names.push(name);
        }
        names
    }

    /// Restituisce la stampante Brother più adatta dall'elenco.
    /// Priorità: "ql-800" > "ql-" > "brother".
    pub fn pick_best_brother(printers: &[String]) -> Option<String> {
        let lower: Vec<(String, &String)> = printers
            .iter()
            .map(|n| (n.to_lowercase(), n))
            .collect();

        if let Some((_, n)) = lower.iter().find(|(l, _)| l.contains("ql-800")) {
            return Some((*n).clone());
        }
        if let Some((_, n)) = lower.iter().find(|(l, _)| l.contains("ql-")) {
            return Some((*n).clone());
        }
        if let Some((_, n)) = lower.iter().find(|(l, _)| l.contains("brother")) {
            return Some((*n).clone());
        }
        None
    }

    // ─── Brother QL-800 raster encoding ────────────────────────────────────
    // Stream RAW spedito allo spooler con datatype "RAW". Bypassa la
    // pipeline GDI del driver Brother (che pre-renderizzava ogni copia
    // separatamente, ~2s per copia su 20 etichette).

    const PRINT_PINS: u32       = 696;  // attivo printable across 62mm tape
    const LEFT_MARGIN_PINS: u32 = 12;   // offset all'interno della testina 720-pin
    const BYTES_PER_LINE: usize = 90;   // 720 / 8

    fn build_brother_raster_62mm(png_bytes: &[u8]) -> Result<Vec<u8>, String> {
        let dyn_img = image::load_from_memory_with_format(png_bytes, image::ImageFormat::Png)
            .map_err(|e| format!("PNG decode error: {e}"))?;
        let orig_w = dyn_img.width();
        let orig_h = dyn_img.height();
        if orig_w == 0 || orig_h == 0 {
            return Err("PNG has zero dimensions".to_string());
        }

        let target_h = ((orig_h as u64 * PRINT_PINS as u64 + orig_w as u64 / 2)
            / orig_w as u64) as u32;
        let scaled = dyn_img.resize_exact(
            PRINT_PINS,
            target_h,
            image::imageops::FilterType::Triangle,
        );
        let luma = scaled.to_luma8();
        let n_lines = luma.height();

        let mut buf: Vec<u8> = Vec::with_capacity(
            200 + 64 + (3 + BYTES_PER_LINE) * n_lines as usize + 1,
        );

        // Invalidate + initialize.
        buf.extend(std::iter::repeat(0u8).take(200));
        buf.extend_from_slice(&[0x1B, 0x40]);

        // Switch to raster command mode.
        buf.extend_from_slice(&[0x1B, 0x69, 0x61, 0x01]);

        // Print information command (ESC i z):
        //   flags 0x8E = PI_KIND | PI_WIDTH | PI_LENGTH | PI_RECOVER
        //   media_type 0x0A = continuous length tape
        //   media_width 62 mm, media_length 0 (continuous)
        //   raster_number = n_lines (little-endian u32)
        //   starting page = 0, reserved = 0
        buf.extend_from_slice(&[0x1B, 0x69, 0x7A]);
        buf.push(0x8E);
        buf.push(0x0A);
        buf.push(62);
        buf.push(0);
        buf.extend_from_slice(&n_lines.to_le_bytes());
        buf.push(0);
        buf.push(0);

        // Various mode: auto-cut enabled (bit 6).
        buf.extend_from_slice(&[0x1B, 0x69, 0x4D, 0x40]);

        // Cut every 1 label.
        buf.extend_from_slice(&[0x1B, 0x69, 0x41, 0x01]);

        // Compression mode = uncompressed: richiesto dal QL-800 prima del
        // primo `g` per evitare interpretazione TIFF dei raster bytes.
        buf.extend_from_slice(&[0x4D, 0x00]);

        // Raster lines: uncompressed `g 0x00 0x5A <90 bytes>`.
        // Pin layout: 12 zero-bits margine, 696 bit immagine, 12 zero-bits margine.
        // Lettura del PNG da destra a sinistra: il QL-800 mappa "pin 0" sul
        // bordo che l'utente vede come destro a etichetta espulsa, quindi
        // serve il flip orizzontale per stampare leggibile invece che a specchio.
        for row in 0..n_lines {
            buf.extend_from_slice(&[0x67, 0x00, 0x5A]);
            let mut line = [0u8; BYTES_PER_LINE];
            for col in 0..PRINT_PINS {
                let src_col = PRINT_PINS - 1 - col;
                let px = luma.get_pixel(src_col, row).0[0];
                if px < 128 {
                    let pin = col + LEFT_MARGIN_PINS;
                    let byte_idx = (pin / 8) as usize;
                    let bit_pos = 7 - (pin % 8) as u8;
                    line[byte_idx] |= 1 << bit_pos;
                }
            }
            buf.extend_from_slice(&line);
        }

        // End of page: print + feed + cut.
        buf.push(0x1A);

        Ok(buf)
    }

    fn send_raw_to_printer(
        printer_name: &str,
        buffer: &[u8],
        copies: u32,
    ) -> Result<(), String> {
        let printer_wide = to_wide(printer_name);
        let mut h_printer: HANDLE = null_mut();
        let ok = unsafe {
            OpenPrinterW(
                printer_wide.as_ptr() as *mut _,
                &mut h_printer,
                null_mut(),
            )
        };
        if ok == 0 || h_printer.is_null() {
            return Err(format!("OpenPrinter failed for '{}'", printer_name));
        }

        // RAII: ClosePrinter sempre, anche su early-return.
        struct PrinterGuard(HANDLE);
        impl Drop for PrinterGuard {
            fn drop(&mut self) { unsafe { ClosePrinter(self.0); } }
        }
        let _printer_guard = PrinterGuard(h_printer);

        let mut doc_name = to_wide("HACCPrint Label");
        let mut datatype = to_wide("RAW");
        let mut doc_info = DOC_INFO_1W {
            pDocName:    doc_name.as_mut_ptr(),
            pOutputFile: null_mut(),
            pDatatype:   datatype.as_mut_ptr(),
        };

        let job_id = unsafe {
            StartDocPrinterW(
                h_printer,
                1,
                &mut doc_info as *mut _ as *mut u8,
            )
        };
        if job_id == 0 {
            return Err("StartDocPrinter failed — is the printer ready?".to_string());
        }

        // RAII: EndDocPrinter prima di ClosePrinter (drop order LIFO).
        struct DocGuard(HANDLE);
        impl Drop for DocGuard {
            fn drop(&mut self) { unsafe { EndDocPrinter(self.0); } }
        }
        let _doc_guard = DocGuard(h_printer);

        let ok = unsafe { StartPagePrinter(h_printer) };
        if ok == 0 {
            return Err("StartPagePrinter failed".to_string());
        }

        struct PageGuard(HANDLE);
        impl Drop for PageGuard {
            fn drop(&mut self) { unsafe { EndPagePrinter(self.0); } }
        }
        let _page_guard = PageGuard(h_printer);

        // Render once, send N times — etichette identiche condividono il buffer.
        // Lo spooler RAW è pass-through: la prima etichetta parte non appena
        // il primo WritePrinter ha flushato verso l'USB.
        for copy_idx in 0..copies {
            let mut written: DWORD = 0;
            let ok = unsafe {
                WritePrinter(
                    h_printer,
                    buffer.as_ptr() as *mut _,
                    buffer.len() as DWORD,
                    &mut written,
                )
            };
            if ok == 0 || (written as usize) != buffer.len() {
                return Err(format!(
                    "WritePrinter failed on copy {} ({}/{} bytes)",
                    copy_idx + 1, written, buffer.len()
                ));
            }
        }

        Ok(())
    }

    pub fn print_png(
        png_bytes: &[u8],
        printer_name: &str,
        copies: u32,
        _label_w_mm: f64,
        _label_h_mm: f64,
    ) -> Result<(), String> {
        let buffer = build_brother_raster_62mm(png_bytes)?;
        send_raw_to_printer(printer_name, &buffer, copies.max(1))
    }
}

#[tauri::command]
fn list_printers() -> Vec<String> {
    #[cfg(target_os = "windows")]
    { win_print::list_printers() }
    #[cfg(not(target_os = "windows"))]
    { vec![] }
}

#[tauri::command]
fn find_brother_printer() -> Option<String> {
    #[cfg(target_os = "windows")]
    { win_print::pick_best_brother(&win_print::list_printers()) }
    #[cfg(not(target_os = "windows"))]
    { None }
}

#[tauri::command]
fn print_label_image(
    png_base64: String,
    copies: u32,
    printer_name: Option<String>,
    label_w_mm: Option<f64>,
    label_h_mm: Option<f64>,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use base64::Engine;
        let png_bytes = base64::engine::general_purpose::STANDARD
            .decode(&png_base64)
            .map_err(|e| format!("Base64 decode error: {e}"))?;

        let printer = match printer_name {
            Some(ref n) if !n.is_empty() => n.clone(),
            _ => {
                let list = win_print::list_printers();
                win_print::pick_best_brother(&list)
                    .unwrap_or_else(|| "Brother QL-800".to_string())
            }
        };

        let w_mm = label_w_mm.unwrap_or(62.0);
        let h_mm = label_h_mm.unwrap_or(100.0);

        win_print::print_png(&png_bytes, &printer, copies.max(1), w_mm, h_mm)?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (png_base64, copies, printer_name, label_w_mm, label_h_mm);
        Err("Printing is only available on Windows.".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![print_label_image, list_printers, find_brother_printer])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}