// apps/desktop/src-tauri/src/hardware/escpos.rs
// ─────────────────────────────────────────────────────────────
// Minimal ESC/POS byte-stream builder.
// This is a MOCK/PLACEHOLDER implementation: it demonstrates the
// exact command bytes a real 58mm/80mm thermal printer expects,
// but ships with a small, hand-rolled subset rather than a full
// vendor SDK. Swap the `write_to_port` call in printer.rs for a
// real driver (e.g. `escpos` crate) when hardware is on hand.
// ─────────────────────────────────────────────────────────────

/// Builds ESC/POS byte sequences incrementally.
pub struct EscPosBuilder {
    buffer: Vec<u8>,
}

impl EscPosBuilder {
    pub fn new() -> Self {
        let mut b = Self { buffer: Vec::new() };
        b.init();
        b
    }

    /// ESC @  — initialize / reset printer state
    fn init(&mut self) -> &mut Self {
        self.buffer.extend_from_slice(&[0x1B, 0x40]);
        self
    }

    /// Plain text line, followed by line feed (LF).
    pub fn text_line(&mut self, s: &str) -> &mut Self {
        self.buffer.extend_from_slice(s.as_bytes());
        self.buffer.push(0x0A);
        self
    }

    /// ESC a n — alignment: 0 = left, 1 = center, 2 = right
    pub fn align(&mut self, n: u8) -> &mut Self {
        self.buffer.extend_from_slice(&[0x1B, 0x61, n]);
        self
    }

    /// ESC E n — bold on/off
    pub fn bold(&mut self, on: bool) -> &mut Self {
        self.buffer.extend_from_slice(&[0x1B, 0x45, if on { 1 } else { 0 }]);
        self
    }

    /// GS ! n — font size (double width/height variants)
    pub fn font_size(&mut self, width_x2: bool, height_x2: bool) -> &mut Self {
        let mut n: u8 = 0x00;
        if width_x2 { n |= 0x10; }
        if height_x2 { n |= 0x01; }
        self.buffer.extend_from_slice(&[0x1D, 0x21, n]);
        self
    }

    /// Draws a dashed divider line sized for the given paper width.
    pub fn divider(&mut self, paper_width_mm: u16) -> &mut Self {
        // ~ 32 chars for 58mm roll, ~48 chars for 80mm roll at default font
        let chars = if paper_width_mm <= 58 { 32 } else { 48 };
        self.text_line(&"-".repeat(chars))
    }

    /// GS V m — paper cut. m=0 full cut, m=1 partial cut.
    pub fn cut(&mut self, partial: bool) -> &mut Self {
        self.buffer.extend_from_slice(&[0x1D, 0x56, if partial { 1 } else { 0 }]);
        self
    }

    /// DLE DC4 fn m t — pulse pin to open cash drawer (kick-out connector).
    /// fn=1 (drawer pin 2), m=on time, t=off time (both in ~2ms units).
    pub fn open_cash_drawer(&mut self) -> &mut Self {
        self.buffer.extend_from_slice(&[0x10, 0x14, 0x01, 0x00, 0x19, 0x19]);
        self
    }

    /// Feed n blank lines — typically used before cut to clear the cutter blade.
    pub fn feed_lines(&mut self, n: u8) -> &mut Self {
        self.buffer.extend_from_slice(&[0x1B, 0x64, n]);
        self
    }

    pub fn build(&self) -> Vec<u8> {
        self.buffer.clone()
    }
}

impl Default for EscPosBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_non_empty_byte_stream_with_init_prefix() {
        let bytes = EscPosBuilder::new().text_line("hello").build();
        assert_eq!(&bytes[0..2], &[0x1B, 0x40]); // ESC @
        assert!(bytes.len() > 2);
    }

    #[test]
    fn cash_drawer_pulse_matches_spec() {
        let bytes = EscPosBuilder::new().open_cash_drawer().build();
        assert!(bytes.windows(6).any(|w| w == [0x10, 0x14, 0x01, 0x00, 0x19, 0x19]));
    }
}
