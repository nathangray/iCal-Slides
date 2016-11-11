var SlideMaker = function() {
	var messageNode;
	var dateFormat = 'dddd LL';
	var template_set = 'plain';
	var fields = ['summary','description', 'start', 'end', 'time', 'duration', 'recurrence'];

	var baseCSS = '';
	var templateCSS = '';

	var fetchICal;
	var readICalFile;
	var parseIcal;

	var setTemplate;

	var massageEvent;
	var slideSingleEvent;
	var makeSlides;

	/**
	 * Reset the iCal parser
	 * 
	 * If we don't empty the parser, it will add if we read another file
	 */
	_resetParser = function _resetParser() {
		// Reset parser
		icalParser.ical={
			version:'',
			prodid:'',
			events:[],
			todos:[],
			journals:[],
			freebusys:[]
		};
	};

	/**
	 * Take the provided element, turn it into an image, and download it
	 * 
	 * @param {DOMNode} element
	 */
	_makeImage = function _makeImage(element) {

		// Clone out of thumbnail to get proper height
		var clone = jQuery(element).clone().appendTo('body');

		var data   = "<svg xmlns='http://www.w3.org/2000/svg' width='"+clone.outerWidth() + "' height='"+clone.outerHeight() + "'>" +
						"<foreignObject width='100%' height='100%'>" +
							"<div xmlns='http://www.w3.org/1999/xhtml' >" +
							"<style>"+templateCSS+"</style>" +
							element.outerHTML+
							'</div>' +
					   '</foreignObject>' +
				//' <text y="90">" \' # % &amp; ¿ 🔣</text>'+
					'</svg>';
		//var svg = jQuery(data).appendTo('body')[0];
		var img = jQuery("<img src='data:image/svg+xml;base64,"+svgEncode(data)+"'/>").appendTo('body')[0];

		var canvas = jQuery('<canvas/>')[0];
		canvas.width = clone.outerWidth();
		canvas.height = clone.outerHeight();

		var ctx = canvas.getContext('2d');

		img.onload = function () {
			ctx.drawImage(img, 0, 0);

			canvas.toBlob(function(blob) {
				_download(URL.createObjectURL(blob), 'slide.png');
			});

			img.remove();
		};

		clone.remove();
	};

	/**
	 * Download the given element as a file
	 * 
	 * @param {type} element
	 * @param {type} filename
	 * @returns {undefined}
	 */
	_download: function _download(element, filename) {
		var pom = document.createElement('a');

		pom.setAttribute('href',element);
		pom.setAttribute('download', filename);
//return pom;
		if (document.createEvent) {
			var event = document.createEvent('MouseEvents');
			event.initEvent('click', true, true);
			pom.dispatchEvent(event);
		}
		else {
			pom.click();
		}
	};

	/**
	 * Read and parse an iCal file from the provided URL
	 *
	 * @param {String} file
	 * @param {moment|Date} start
	 * @param {moment|Date} end
	 * @returns {Promise}
	 */
	fetchICal = function fetchICal(ical_url, start, end) {

		// Reset parser
		_resetParser();

		return new Promise(function (resolve, reject) {

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

	/**
	 * Read and parse an iCal file uploded by the user
	 *
	 * @param {File} file
	 * @param {moment|Date} start
	 * @param {moment|Date} end
	 * @returns {Promise}
	 */
	readICalFile = function readICalFile(file, start, end) {

		// Reset parser
		_resetParser();
		
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

	/**
	 * Parse the iCal file into an array of objects
	 *
	 * @param {String} ical_contents
	 * @param {moment|Date} start
	 * @param {moment|Date} end
	 * @returns {Array}
	 */
	parseIcal = function parseIcal(ical_contents, start, end) {
		icalParser.parseIcal(ical_contents);
		var events = icalParser.getEvents();
		var in_range = [];

		// Check events are in specified range
		for(var i = 0; i < events.length; i++)
		{
			var event = events[i];
			event.start = moment(event.dtstart.value).local();
			if(event.dtend && event.dtend.value)
			{
				event.end = moment(event.dtend.value).local();
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

					// Get unrestricted recurrence for display
					var unclippedRRule = new RRule(rrule);
					event.recurrence = unclippedRRule.toText();

					// End infinite recurrences at our end date
					if(!rrule.until)
					{
						rrule.until = end.toDate();
					}
					set.rrule(new RRule(rrule));
				}
				var recurring = set.between(start.toDate(), end.toDate());
				var duration = event.end.diff(event.start, 'minutes');
				for(var j = 0; j < recurring.length; j++)
				{
					var recurrence = jQuery.extend(true, {}, event);
					recurrence.start = moment(moment(recurring[j]));
					recurrence.end = moment(moment(recurring[j]));
					recurrence.end.add(duration,'minutes');
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

	/**
	 * Massage an event around so it has everything we need, in a nice format
	 *
	 * This includes formatting dates, avoiding empty fields and breaking
	 * multi-line text up, if needed
	 * 
	 * @param {Object} event
	 * @returns {Object} modified event
	 */
	massageEvent = function massageEvent(unchanged_event, template)
	{
		var event = jQuery.extend(true, {}, unchanged_event);

		// Extra fields
		var duration = moment.duration(event.end.diff(event.start, 'minutes'),'minutes');
		event.duration = (duration.asHours() > 1 ? duration.asHours() + ' hours' : duration.humanize());
		event.time = event.start.format(dateFormat + ' h:mm') + ' (' + event.duration + ')'
		if(event.start.format('YYYY-MM-DD') !== event.end.format('YYYY-MM-DD'))
		{
			event.time = event.start.format(dateFormat) + ' - ' + event.end.format(dateFormat);
		}

		// Massage & format ical fields
		for(var i = 0; i < fields.length; i++)
		{
			var value = event[fields[i]] ? event[fields[i]] : '';
			var svgField = jQuery('#'+fields[i],template);
			if(typeof value !== 'string' && typeof value.value === 'string')
			{
				value = value.value;
			}
			if(typeof value === 'object' && value.format)
			{
				value = value.format(dateFormat);
			}
			/* only needed for SVG
			if(typeof value === 'string' && value.indexOf('\\n') >= 0)
			{
				var split = value.split('\\n');
				value = '';
				for(var j = 0; j < split.length; j++)
				{
					value+='<tspan x="'+svgField.attr('x')+'" dy="'+( i) +'em">'+split[j]+'</tspan>';
				}
			}
			*/

			// For HTML
		    value = value.replace(/\\n/g,'<br />');
			event[fields[i]] = value;
		}
		return event;
	};

	setTemplate = function setTemplate(template)
	{
		template_set = template;
		
		var xhr = new XMLHttpRequest();
		xhr.open('GET', 'css/templates/'+template+'.css', true);
		xhr.onload = function(e) {
			if (this.status === 200) {

				if(!baseCSS && template.indexOf('slides') >= 0)
				{
					baseCSS = this.response;
				}
				else
				{
					templateCSS = baseCSS + this.response;
				}
			}
			else
			{
				templateCSS = '';
			}
		};
		xhr.send();
	};

	svgEncode = function svgEncode(svg)
	{
		var txt = svg
        .replace('<svg',(~svg.indexOf('xmlns')?'<svg':'<svg xmlns="http://www.w3.org/2000/svg"'))

        //
        //   Encode (may need a few extra replacements)
        //
		/*
        .replace(/"/g, '\'')
        .replace(/%/g, '%25')
        .replace(/#/g, '%23')
        .replace(/{/g, '%7B')
        .replace(/}/g, '%7D')
        .replace(/</g, '%3C')
        .replace(/>/g, '%3E')

        .replace(/\s+/g,' ');
		*/
		return btoa(txt);
	}
	/**
	 * Generate the DOM nodes for a slide for a single event
	 *
	 * @param {Object} event
	 * @returns {undefined}
	 */
	slideSingleEvent = function slideSingleEvent(event)
	{
		var template = jQuery('<div class="slide single_event ' + template_set + '"></div>');
		var fixed = massageEvent(event, template);
		for(var i = 0; i < fields.length; i++)
		{
			var value = fixed[fields[i]] ? fixed[fields[i]] : '';
			if(value)
			{
				template.append('<span class="'+fields[i]+'">' + value + '</span>');
			}
		}
		return template;
		
	};
	
	makeSlides = function makeSlides(ical_url, start, end)
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
			var target = jQuery('#output');;
			if(messageNode)
			{
				messageNode.append('<span>'+start.format(dateFormat) + ' - ' + end.format(dateFormat) + ': ' + events.length + ' events found</span>');
			}
			if(!events.length)
			{
				return;
			}
			for(var i = 0; i < events.length; i++)
			{
				slideSingleEvent(events[i]).appendTo(target).wrap('<div class="thumbnail"></div>');
			}

			target.on('click', '.slide', function() { _makeImage(this);});
		}

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
	};


	// Load base CSS
	setTemplate('../slides');
	templateCSS = baseCSS;

	return {
		dateFormat: dateFormat,
		_fetchICal: fetchICal,
		makeSlides: makeSlides,
		setMessageNode: function setMessageNode(node) {
			messageNode = jQuery(node);
		},
		setTemplate: setTemplate,
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
};


