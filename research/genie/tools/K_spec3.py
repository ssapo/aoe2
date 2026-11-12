EDITS=[
("""    pub fn record(&mut self, now: BackToWork) {
        if self.flag.is_sheltered() || now == self.work {
""","""    pub fn record(&mut self, now: BackToWork) {
        if std::env::var_os("GENIE_TRACE_BELL").is_some() {
            eprintln!(
                "BELL_RECORD flag={:?} now={now:?} work={:?} before={:?}",
                self.flag, self.work, self.before_building
            );
        }
        if self.flag.is_sheltered() || now == self.work {
"""),
("""        let (found, out) = record_object(self.work, lookup, roles)?;
        if found.is_some() {
            return Ok((found, out));
        }
        let before = self.before_building;
""","""        if std::env::var_os("GENIE_TRACE_BELL").is_some() {
            eprintln!(
                "BELL_BACK flag={:?} work={:?} before={:?}",
                self.flag, self.work, self.before_building
            );
        }
        let (found, out) = record_object(self.work, lookup, roles)?;
        if found.is_some() {
            return Ok((found, out));
        }
        let before = self.before_building;
"""),
]
