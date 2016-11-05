var SlideMaker = function() {
	var fetchICal = function fetchICal(ical_url, start, end) {
		return new Promise(function (resolve, reject) {

			// Reset parser
			icalParser.ical={
				version:'',
				prodid:'',
				events:[],
				todos:[],
				journals:[],
				freebusys:[]
			};

			var xhr = new XMLHttpRequest();

			xhr.open('GET', ical_url, true);
			xhr.onload = function(e) {
				if (this.status == 200) {
					
					resolve( parseIcal(this.response, start, end) );
				}
				else
				{
					reject({
						status: this.status,
						statusText: xhr.statusText
					});
				}
			};
			xhr.onerror = function () {
				reject({
					status: this.status,
					statusText: xhr.statusText
				});
			};
		  xhr.send();
		});
	};
	
	var readICalFile = function readICalFile(file, start, end) {
		return new Promise(function(resolve, reject) {
			var reader = new FileReader();
			reader.onload = (function(theFile) {
				return function(e) {
					resolve(parseIcal(e.target.result, start, end));
				};
			  })(file);

			  // Read in the image file as a data URL.
			  reader.readAsText(file);
		});
	}
	
	var parseIcal = function parseIcal(ical_contents, start, end) {
		icalParser.parseIcal(ical_contents);
		var events = icalParser.getEvents();
		var in_range = [];

		// Check events are in specified range
		for(var i = 0; i < events.length; i++)
		{
			var event = events[i];
			event.start = moment(event.dtstart.value);
			if(event.dtend && event.dtend.value)
			{
				event.end = moment(event.dtend.value);
				event.duration = moment.interval(event.start, event.end);
			}
			else if (event.duration && event.duration.value)
			{
				event.duration = moment.interval(event.start, moment.duration(event.duration.value));
				event.end = event.duration.end();
			}

			if(event.rrule)
			{
				// Event has recurrences, check for them
				var set = new RRuleSet();
				for(var j = 0; j < event.rrule.length; j++)
				{
					try {
						var rrule = RRule.parseString(event.rrule[j].value);
					} catch (e) {
						if(e.message.indexOf('Invalid UNTIL value') >= 0)
						{
							var rrule = RRule.parseString(event.rrule[j].value + 'Z');
						}
					}
					if(moment(rrule.dtstart).format('YmdHmm') === moment().format('YmdHmm'))
					{
						rrule.dtstart = event.start.toDate();
					}

					// End infinite recurrences at our end date
					if(!rrule.until)
					{
						rrule.until = end.toDate();
					}
					set.rrule(new RRule(rrule));
				}
				var recurring = set.between(start.toDate(), end.toDate());
				for(var j = 0; j < recurring.length; j++)
				{
					var recurrence = jQuery.extend(true, {}, event);
					recurrence.start = moment(moment(recurring[j]));
					in_range.push(recurrence);
				}
			}
			else if(event.start && event.end && (event.start.isBetween(start, end, 'days', '[]') || event.end.isBetween(start, end, 'days','[]')))
			{
				// Single event, in range
				in_range.push(event);
			}
		}
		return in_range;
	};

	var makeSlides = function makeSlides(ical_url, start, end)
	{
		if(typeof start === 'undefined')
		{
			start = moment().startOf('week');
		}
		if(typeof end === 'undefined')
		{
			end = start.clone().endOf('week');
		}
		
		var _makeSlides = function _makeSlides(events)
		{
			console.log(events.length + ' events found');
			if(!events.length)
			{
				return;
			}
			makeWeeklySlide
		};

		// Load events
		if(typeof ical_url === 'string')
		{
			fetchICal(ical_url, start, end)
				.then(function(events) {
					// Make slides
					_makeSlides(events);
				});
		}
		else if (typeof ical_url.name === 'string')
		{
			readICalFile(ical_url, start, end)
				.then(function(events) {
					// Make slides
					_makeSlides(events);
				});
		}
	}
	return {
		_fetchICal: fetchICal,
		makeSlides: makeSlides
	};
}();
window.onload=function(){

	function fetchImage() {

	  var xhr = new XMLHttpRequest();
	  xhr.open('GET', 'https://raw.githubusercontent.com/mozilla-comm/ical.js/master/samples/daily_recur.ics', true);
	  xhr.responseType = 'blob';

	  xhr.onload = function(e) {
	    if (this.status == 200) {
	      // Note: .response instead of .responseText
	      var blob = new Blob([this.response], {type: 'image/png'});
	      debugger;
	    }
	  };

	  xhr.send();
	}
	//var ical = 'https://raw.githubusercontent.com/mozilla-comm/ical.js/master/samples/daily_recur.ics';
	//var ical = 'https://raw.githubusercontent.com/mozilla-comm/ical.js/master/samples/google_birthday.ics';
	var ical = 'http://localhost/trunk/egroupware/share.php/HVpekHRLEZqHa5b4uur1khi2B9m5ctYt';
	SlideMaker.makeSlides(ical, moment('20110101'), moment());
};

/**
 * Load & parse a local iCal file
 */
function fileChanged(event) {
	for(var i = 0; i < event.target.files.length; i++)
	{
		var file = event.target.files[i];
		SlideMaker.makeSlides(file);
	}
}
