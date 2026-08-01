// apps/desktop/src-tauri/src/commands/printer.rs
// ─────────────────────────────────────────────────────────────
// #[tauri::command] handlers invoked from TauriPrinterService.ts.
// Field names here match the camelCase JSON sent by `invoke()` —
// Tauri auto-converts to snake_case Rust fields via serde rename.
// ─────────────────────────────────────────────────────────────

use serde::{Deserialize, Serialize};

use crate::error::AppResult;
use crate::hardware::escpos::EscPosBuilder;
use crate::hardware::serial::{resolve_port, RealSerialPort};

// ── DTOs (mirror packages/core/src/types/domain.ts) ─────────

#[derive(Debug, Deserialize)]
pub struct CartLineDto {
    pub product: ProductDto,
    pub quantity: f64,
    #[serde(rename = "unitPrice")]
    pub unit_price: i64,
    pub total: i64,
}

#[derive(Debug, Deserialize)]
pub struct ProductDto {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct PaymentLineDto {
    pub method: String,
    pub amount: i64,
}

#[derive(Debug, Deserialize)]
pub struct SaleDto {
    #[serde(rename = "localId")]
    pub local_id: String,
    #[serde(rename = "registerId")]
    pub register_id: String,
    pub lines: Vec<CartLineDto>,
    pub payments: Vec<PaymentLineDto>,
    pub subtotal: i64,
    #[serde(rename = "discountTotal")]
    pub discount_total: i64,
    #[serde(rename = "taxTotal")]
    pub tax_total: i64,
    #[serde(rename = "grandTotal")]
    pub grand_total: i64,
    #[serde(rename = "changeGiven")]
    pub change_given: i64,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct PrintResultDto {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub printer_used: Option<String>,
}

impl PrintResultDto {
    fn ok(printer_used: String) -> Self {
        Self { success: true, error_message: None, printer_used: Some(printer_used) }
    }
    fn fail(msg: impl Into<String>) -> Self {
        Self { success: false, error_message: Some(msg.into()), printer_used: None }
    }
}

fn money(cents: i64) -> String {
    format!("{:.2}", cents as f64 / 100.0)
}

// ── print_receipt ────────────────────────────────────────────

#[tauri::command]
pub async fn print_receipt(
    sale: SaleDto,
    printer_name: Option<String>,
    paper_width: u16,
    copies: u8,
    open_cash_drawer: bool,
) -> AppResult<PrintResultDto> {
    let mut builder = EscPosBuilder::new();

    builder
        .align(1) // center
        .bold(true)
        .font_size(true, true)
        .text_line("POS RECEIPT")
        .font_size(false, false)
        .bold(false)
        .align(0) // left
        .text_line(&format!("Sale : {}", &sale.local_id[..8.min(sale.local_id.len())]))
        .text_line(&format!("Till : {}", sale.register_id))
        .text_line(&format!("Date : {}", sale.created_at))
        .divider(paper_width);

    for line in &sale.lines {
        builder.text_line(&format!(
            "{:<20} {:>3} x {:>7}",
            truncate(&line.product.name, 20),
            line.quantity,
            money(line.unit_price)
        ));
        builder.align(2); // right-align the line total
        builder.text_line(&money(line.total));
        builder.align(0);
    }

    builder
        .divider(paper_width)
        .text_line(&format!("Subtotal : {}", money(sale.subtotal)))
        .text_line(&format!("Discount : -{}", money(sale.discount_total)))
        .text_line(&format!("VAT      : {}", money(sale.tax_total)))
        .bold(true)
        .font_size(false, true)
        .text_line(&format!("TOTAL    : {}", money(sale.grand_total)))
        .font_size(false, false)
        .bold(false)
        .divider(paper_width);

    for payment in &sale.payments {
        builder.text_line(&format!("{:<10} {}", payment.method.to_uppercase(), money(payment.amount)));
    }

    if sale.change_given > 0 {
        builder.text_line(&format!("Change   : {}", money(sale.change_given)));
    }

    builder
        .divider(paper_width)
        .align(1)
        .text_line("Thank you for your purchase!")
        .feed_lines(3);

    if open_cash_drawer {
        builder.open_cash_drawer();
    }

    builder.cut(true);

    let bytes = builder.build();

    let mut port = match resolve_port(printer_name.as_deref()) {
        Ok(p) => p,
        Err(e) => return Ok(PrintResultDto::fail(e.to_string())),
    };

    for _ in 0..copies.max(1) {
        if let Err(e) = port.write_bytes(&bytes) {
            return Ok(PrintResultDto::fail(e.to_string()));
        }
    }

    Ok(PrintResultDto::ok(port.name()))
}

// ── print_report ─────────────────────────────────────────────

#[tauri::command]
pub async fn print_report(
    title: String,
    generated_at: String,
    rows: Vec<serde_json::Map<String, serde_json::Value>>,
    printer_name: Option<String>,
    paper_width: u16,
) -> AppResult<PrintResultDto> {
    let mut builder = EscPosBuilder::new();

    builder
        .align(1)
        .bold(true)
        .text_line(&title)
        .bold(false)
        .align(0)
        .text_line(&format!("Generated: {generated_at}"))
        .divider(paper_width);

    for row in &rows {
        let line = row
            .iter()
            .map(|(k, v)| format!("{k}: {v}"))
            .collect::<Vec<_>>()
            .join("  ");
        builder.text_line(&line);
    }

    builder.feed_lines(3).cut(true);

    let bytes = builder.build();
    let mut port = match resolve_port(printer_name.as_deref()) {
        Ok(p) => p,
        Err(e) => return Ok(PrintResultDto::fail(e.to_string())),
    };

    if let Err(e) = port.write_bytes(&bytes) {
        return Ok(PrintResultDto::fail(e.to_string()));
    }

    Ok(PrintResultDto::ok(port.name()))
}

// ── test_print ───────────────────────────────────────────────

#[tauri::command]
pub async fn test_print(printer_name: Option<String>) -> AppResult<PrintResultDto> {
    let mut builder = EscPosBuilder::new();
    builder
        .align(1)
        .bold(true)
        .text_line("TEST PRINT")
        .bold(false)
        .text_line("Printer connection OK")
        .feed_lines(3)
        .cut(true);

    let bytes = builder.build();
    let mut port = match resolve_port(printer_name.as_deref()) {
        Ok(p) => p,
        Err(e) => return Ok(PrintResultDto::fail(e.to_string())),
    };

    if let Err(e) = port.write_bytes(&bytes) {
        return Ok(PrintResultDto::fail(e.to_string()));
    }

    Ok(PrintResultDto::ok(port.name()))
}

// ── list_printers ────────────────────────────────────────────

#[tauri::command]
pub async fn list_printers() -> AppResult<Vec<String>> {
    let mut ports = RealSerialPort::list_available_ports();
    ports.push("MOCK".to_string()); // always offer the safe dev fallback
    Ok(ports)
}

// ── helpers ──────────────────────────────────────────────────

fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        s.chars().take(max.saturating_sub(1)).collect::<String>() + "…"
    }
}
