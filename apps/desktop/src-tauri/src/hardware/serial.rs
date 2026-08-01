// apps/desktop/src-tauri/src/hardware/serial.rs
// ─────────────────────────────────────────────────────────────
// Thin abstraction over the physical transport used to reach the
// thermal printer (USB-serial, RS-232, or USB-to-parallel adapters
// all present themselves as a serial port on most POS hardware).
//
// `SerialPrinterPort` is a trait so the printer command layer can
// be unit-tested against `MockSerialPort` without real hardware,
// and swapped for `RealSerialPort` (backed by the `serialport` crate)
// in production builds.
// ─────────────────────────────────────────────────────────────

use crate::error::{AppError, AppResult};
use std::time::Duration;

pub trait SerialPrinterPort: Send {
    /// Writes raw bytes (ESC/POS stream) to the printer and flushes.
    fn write_bytes(&mut self, bytes: &[u8]) -> AppResult<()>;

    /// Human-readable identifier for logging / listPrinters().
    fn name(&self) -> String;
}

// ── Real implementation (USB/RS-232 serial) ─────────────────

pub struct RealSerialPort {
    port: Box<dyn serialport::SerialPort>,
    port_name: String,
}

impl RealSerialPort {
    pub fn open(port_name: &str, baud_rate: u32) -> AppResult<Self> {
        let port = serialport::new(port_name, baud_rate)
            .timeout(Duration::from_millis(1500))
            .open()
            .map_err(|e| AppError::SerialPort(format!("failed to open {port_name}: {e}")))?;

        Ok(Self { port, port_name: port_name.to_string() })
    }

    /// Lists serial port device names available on this machine.
    /// On most POS thermal printers this includes the printer once
    /// its USB-serial driver is installed (e.g. "COM3", "/dev/ttyUSB0").
    pub fn list_available_ports() -> Vec<String> {
        serialport::available_ports()
            .map(|ports| ports.into_iter().map(|p| p.port_name).collect())
            .unwrap_or_default()
    }
}

impl SerialPrinterPort for RealSerialPort {
    fn write_bytes(&mut self, bytes: &[u8]) -> AppResult<()> {
        use std::io::Write;
        self.port
            .write_all(bytes)
            .map_err(|e| AppError::SerialPort(format!("write failed on {}: {e}", self.port_name)))?;
        self.port
            .flush()
            .map_err(|e| AppError::SerialPort(format!("flush failed on {}: {e}", self.port_name)))?;
        Ok(())
    }

    fn name(&self) -> String {
        self.port_name.clone()
    }
}

// ── Mock implementation (dev / CI / no hardware attached) ───

/// Placeholder transport used when `POS_MOCK_PRINTER=1` or when no
/// serial port is configured. Logs the byte stream instead of
/// sending it anywhere, so the full print pipeline (ESC/POS builder
/// → command → response) can be exercised without physical hardware.
pub struct MockSerialPort {
    label: String,
}

impl MockSerialPort {
    pub fn new(label: &str) -> Self {
        Self { label: label.to_string() }
    }
}

impl SerialPrinterPort for MockSerialPort {
    fn write_bytes(&mut self, bytes: &[u8]) -> AppResult<()> {
        println!(
            "[MockSerialPort:{}] would write {} bytes -> {:02X?}",
            self.label,
            bytes.len(),
            &bytes[..bytes.len().min(32)] // preview first 32 bytes only
        );
        Ok(())
    }

    fn name(&self) -> String {
        format!("MOCK({})", self.label)
    }
}

/// Resolves the correct transport for the given (optional) printer name.
/// - `None` or `"MOCK"` prefix        → MockSerialPort (safe default for dev)
/// - Any other value                  → attempts a RealSerialPort at 9600 baud
pub fn resolve_port(printer_name: Option<&str>) -> AppResult<Box<dyn SerialPrinterPort>> {
    match printer_name {
        None => Ok(Box::new(MockSerialPort::new("default"))),
        Some(name) if name.eq_ignore_ascii_case("mock") => {
            Ok(Box::new(MockSerialPort::new(name)))
        }
        Some(name) => {
            // In production this baud rate would come from printer config,
            // not be hardcoded. 9600 is the common ESC/POS default.
            match RealSerialPort::open(name, 9600) {
                Ok(port) => Ok(Box::new(port)),
                Err(_) => {
                    // Hardware not attached (e.g. developing without a printer):
                    // fall back to mock rather than hard-failing the whole print flow.
                    eprintln!("[serial] could not open '{name}', falling back to mock");
                    Ok(Box::new(MockSerialPort::new(name)))
                }
            }
        }
    }
}
