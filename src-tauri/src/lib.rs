use tauri::Manager;

/// Called by the React frontend to print a label.
/// In production this sends the job to the Brother QL-800 via
/// the Windows print spooler (standard printer API).
///
/// For now it uses the system default printer via a simple
/// text print job — Brother P-touch drivers expose the printer
/// as a normal Windows printer once installed, so this works
/// without any USB-raw hacks.
#[tauri::command]
fn print_label(
    text: String,
    copies: u32,
    printer_name: Option<String>,
) -> Result<(), String> {
    // On Windows, delegate to PowerShell so we don't need a
    // heavy print crate. This is reliable for the QL-800 with
    // official Brother drivers installed.
    #[cfg(target_os = "windows")]
    {
        let printer = printer_name.unwrap_or_else(|| detect_brother_printer());
        for _ in 0..copies {
            let script = format!(
                r#"
$text = @'
{text}
'@
$bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
$stream = [System.IO.MemoryStream]::new($bytes)
$job = New-Object -ComObject WScript.Network
# Use .NET printing for reliability
Add-Type -AssemblyName System.Drawing
$pd = New-Object System.Drawing.Printing.PrintDocument
$pd.PrinterSettings.PrinterName = "{printer}"
$pd.add_PrintPage({{
    param($s, $e)
    $font = New-Object System.Drawing.Font("Arial", 10)
    $e.Graphics.DrawString($text, $font, [System.Drawing.Brushes]::Black, 10, 10)
    $e.HasMorePages = $false
}})
$pd.Print()
"#,
                text = text.replace('\'', "''"),
                printer = printer
            );

            std::process::Command::new("powershell")
                .args(["-NoProfile", "-Command", &script])
                .output()
                .map_err(|e| format!("Print failed: {e}"))?;
        }
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        // macOS / Linux fallback via lpr
        let _ = printer_name;
        for _ in 0..copies {
            let mut child = std::process::Command::new("lpr")
                .stdin(std::process::Stdio::piped())
                .spawn()
                .map_err(|e| format!("lpr failed: {e}"))?;
            if let Some(stdin) = child.stdin.as_mut() {
                use std::io::Write;
                stdin
                    .write_all(text.as_bytes())
                    .map_err(|e| format!("Write failed: {e}"))?;
            }
            child.wait().map_err(|e| format!("lpr wait failed: {e}"))?;
        }
        Ok(())
    }
}

/// Try to find the Brother QL printer name from the Windows printer list.
#[cfg(target_os = "windows")]
fn detect_brother_printer() -> String {
    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "Get-Printer | Where-Object { $_.Name -like '*Brother*' -or $_.Name -like '*QL*' } | Select-Object -First 1 -ExpandProperty Name",
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
        .invoke_handler(tauri::generate_handler![print_label])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
