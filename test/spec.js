/* Test code */
describe("Testing iCal parser", function() {
	it("Single event - in range", function() {
		return SlideMaker._fetchICal('./base/test/blank_description.ics',moment('20120601'), moment('20120630')).then(
			function(data) {
				expect(data.length).toBe(1);
			}
		);
	});
	it("Single event - out of range", function() {
		return SlideMaker._fetchICal('./base/test/blank_description.ics',moment('20160601'), moment('20160630')).then(
			function(data) {
				expect(data.length).toBe(0);
			}
		);
	});
	it("Daily recurring event - one recurrence", function() {
		return SlideMaker._fetchICal('./base/test/daily_recur.ics',moment('20160801'), moment('20160802')).then(
			function(data) {
				expect(data.length).toBe(1);
			}
		);
	});
	it("Daily recurring event - two recurrences", function() {
		return SlideMaker._fetchICal('./base/test/daily_recur.ics',moment('20160801'), moment('20160803')).then(
			function(data) {
				expect(data.length).toBe(2);
			}
		);
	});
	it("Recurring event - monthly with end", function() {
		return SlideMaker._fetchICal('./base/test/recur_instances_finite.ics',moment('20121101'), moment('20131110')).then(
			function(data) {
				expect(data.length).toBe(2);
			}
		);
	});
	it("Recurring event - monthly, out of range", function() {
		return SlideMaker._fetchICal('./base/test/recur_instances_finite.ics',moment('20161101'), moment('20161110')).then(
			function(data) {
				expect(data.length).toBe(0);
			}
		);
	});
	it("Duration instead of end (P1D)", function() {
		SlideMaker._fetchICal('./base/test/duration_instead_of_dtend.ics',moment('20120630'), moment('20120701')).then(
			function(data) {
				expect(data.length).toBe(1);
				expect(data[0].duration.period().humanize()).toEqual('a day');
				
			}
		);
	});
	it("Duration instead of end, out of range", function() {
		return SlideMaker._fetchICal('./base/test/duration_instead_of_dtend.ics',moment('20161101'), moment('20161110')).then(
			function(data) {
				expect(data.length).toBe(0);
			}
		);
	});
});
