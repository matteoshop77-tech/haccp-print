#[tauri::command]
fn print_label_image(
    png_base64: String,
    copies: u32,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::io::Write;

        // Decode base64 PNG
        let png_bytes = base64::decode(&png_base64)
            .map_err(|e| format!("Base64 decode error: {e}"))?;

        // Write PNG to a temp file
        let temp_path = std::env::temp_dir().join("haccprint_label.png");
        let mut f = std::fs::File::create(&temp_path)
            .map_err(|e| format!("Cannot create temp file: {e}"))?;
        f.write_all(&png_bytes)
            .map_err(|e| format!("Cannot write temp file: {e}"))?;
        drop(f);

        let temp_str = temp_path.to_string_lossy();

        // Find Brother printer
        let printer = detect_brother_printer();

        for _ in 0..copies {
            let script = format!(
                r#"
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

$img = [System.Drawing.Image]::FromFile("{temp}")
$pd = New-Object System.Drawing.Printing.PrintDocument
$pd.PrinterSettings.PrinterName = "{printer}"
$pd.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0,0,0,0)
$pd.DefaultPageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize("Custom", [int]($img.Width / 3.96), [int]($img.Height / 3.96))

$pd.add_PrintPage({{
    param($s, $e)
    $e.Graphics.DrawImage($img, 0, 0, $e.PageBounds.Width, $e.PageBounds.Height)
    $e.HasMorePages = $false
}})
$pd.Print()
$img.Dispose()
"#,
                temp = temp_str.replace('\\', "\\\\"),
                printer = printer
            );

            std::process::Command::new("powershell")
                .args(["-NoProfile", "-NonInteractive", "-Command", &script])
                .output()
                .map_err(|e| format!("Print failed: {e}"))?;
        }

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Printing only supported on Windows".to_string())
    }
}

#[cfg(target_os = "windows")]
fn detect_brother_printer() -> String {
    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "Get-Printer | Where-Object { $_.Name -like '*Brother*' } | Select-Object -First 1 -ExpandProperty Name",
        ])
        .output();

    match output {
        Ok(o) => {
            let name = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if name.is_empty() {
                "Brother QL-800".to_string()
            } else {
                name
            }
        }
        Err(_) => "Brother QL-800".to_string(),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![print_label_image])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}