#[cfg(target_os = "windows")]
mod win_print {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use winapi::um::winspool::*;
    use winapi::um::wingdi::*;
    use winapi::shared::minwindef::*;

    fn to_wide(s: &str) -> Vec<u16> {
        OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
    }

    pub fn list_printers() -> Vec<String> {
        let mut needed: DWORD = 0;
        let mut returned: DWORD = 0;
        unsafe {
            EnumPrintersW(
                PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS,
                std::ptr::null_mut(),
                4,
                std::ptr::null_mut(),
                0,
                &mut needed,
                &mut returned,
            );
        }
        if needed == 0 { return vec![]; }
        let mut buf = vec![0u8; needed as usize];
        let ok = unsafe {
            EnumPrintersW(
                PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS,
                std::ptr::null_mut(),
                4,
                buf.as_mut_ptr(),
                needed,
                &mut needed,
                &mut returned,
            )
        };
        if ok == 0 { return vec![]; }
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

    pub fn print_png(png_bytes: &[u8], printer_name: &str, copies: u32) -> Result<(), String> {
        let img = image::load_from_memory_with_format(png_bytes, image::ImageFormat::Png)
            .map_err(|e| format!("PNG decode error: {e}"))?
            .to_rgba8();
        let img_w = img.width();
        let img_h = img.height();

        // RGBA → BGRA
        let mut bgra: Vec<u8> = Vec::with_capacity((img_w * img_h * 4) as usize);
        for px in img.pixels() {
            bgra.push(px[2]); bgra.push(px[1]); bgra.push(px[0]); bgra.push(px[3]);
        }

        let driver_wide  = to_wide("winspool");
        let printer_wide = to_wide(printer_name);

        let dc = unsafe {
            CreateDCW(
                driver_wide.as_ptr(),
                printer_wide.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
            )
        };
        if dc.is_null() {
            return Err(format!("Impossibile creare DC per '{}'. Driver installato?", printer_name));
        }

        let dpi_x  = unsafe { GetDeviceCaps(dc, LOGPIXELSX) } as f64;
        let scale  = dpi_x / 96.0;
        let dest_w = (img_w as f64 * scale).round() as i32;
        let dest_h = (img_h as f64 * scale).round() as i32;

        let mut doc_name_buf = to_wide("HACCPrint Label");
        let doc_info = DOCINFOW {
            cbSize:       std::mem::size_of::<DOCINFOW>() as i32,
            lpszDocName:  doc_name_buf.as_mut_ptr(),
            lpszOutput:   std::ptr::null_mut(),
            lpszDatatype: std::ptr::null_mut(),
            fwType:       0,
        };

        let job = unsafe { StartDocW(dc, &doc_info) };
        if job <= 0 {
            unsafe { DeleteDC(dc); }
            return Err("StartDoc fallito — stampante pronta?".to_string());
        }

        let bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize:          std::mem::size_of::<BITMAPINFOHEADER>() as DWORD,
                biWidth:         img_w as i32,
                biHeight:        -(img_h as i32),
                biPlanes:        1,
                biBitCount:      32,
                biCompression:   BI_RGB,
                biSizeImage:     0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed:       0,
                biClrImportant:  0,
            },
            bmiColors: [RGBQUAD { rgbBlue: 0, rgbGreen: 0, rgbRed: 0, rgbReserved: 0 }],
        };

        for _ in 0..copies {
            unsafe {
                StartPage(dc);
                StretchDIBits(
                    dc,
                    0, 0, dest_w, dest_h,
                    0, 0, img_w as i32, img_h as i32,
                    bgra.as_ptr() as *const _,
                    &bmi,
                    DIB_RGB_COLORS,
                    SRCCOPY,
                );
                EndPage(dc);
            }
        }

        unsafe {
            EndDoc(dc);
            DeleteDC(dc);
        }
        Ok(())
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
fn print_label_image(
    png_base64: String,
    copies: u32,
    printer_name: Option<String>,
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
                list.into_iter()
                    .find(|n| n.to_lowercase().contains("brother"))
                    .unwrap_or_else(|| "Brother QL-800".to_string())
            }
        };

        win_print::print_png(&png_bytes, &printer, copies.max(1))?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    { let _ = (png_base64, copies, printer_name); Err("Solo Windows".to_string()) }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![print_label_image, list_printers])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}