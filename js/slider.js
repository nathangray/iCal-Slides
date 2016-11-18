var SlideMaker = function() {

	var RECUR_LIMIT = 50;
	
	var messageNode;
	var dateFormat = 'dddd LL';
	var template_set = 'plain';
	var fields = ['summary','description', 'start', 'end', 'time', 'duration', 'recurrence', 'attach'];

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
	 * Resolve one (or more?) attached files.
	 *
	 * Mostly we care about images, I guess.
	 *
	 * The value is checked and the URL for the actual image (looking at you,
	 * Google) is found if the url is not to an image
	 *
	 * @param {Object} event
	 */
	_getAttachments = function _getAttachments(event) {

		var attach = (typeof event.attach.length === 'undefined') ? [event.attach] : event.attach;
		//return new Promise(function (resolve, reject) {
			for(var i = 0; i < attach.length; i++)
			{
				var attachment = attach[i].value;
				if(attachment.match(/\.(jpg|jpeg|png)$/))
				{
					// It's at least supposed to be an image, let browser load it
				}
				else
				{
					var iframe = jQuery('<iframe src="' + attachment + '"></iframe>').appendTo('body');

					debugger;
					_message('Could not load attachment for "' + event.summary.value + '": ' + attachment.value);
					attachment.value = '';
				}
			}

		//});
	};

	/**
	 * Take the provided element, turn it into an image, and download it
	 * 
	 * @param {DOMNode} element
	 */
	_makeImage = function _makeImage(element) {

		// Clone out of thumbnail to get proper height
		var clone = jQuery(element).clone().appendTo('body');

		// Any images need encoding
		var images = [];
		jQuery('div.attach[style*="background-image: url(\'http"]', clone).each(function() {
			var promise = jQuery.Deferred();
			images.push(promise);
			
			var original = jQuery(this);
			var img = new Image();
			img.crossOrigin = 'Anonymous';
			img.onload = function() {
				var canvas = document.createElement('CANVAS');
				var ctx = canvas.getContext('2d');
				canvas.height = original.height();
				canvas.width = original.width();
				ctx.drawImage(this, 0, 0);
				
				original.css('background-image','url(' + canvas.toDataURL('image/png') + ')');
				
				promise.resolve();
			};
			img.src = this.style.backgroundImage.substring(5, this.style.backgroundImage.length - 2);
		});
		
		// Wait for images to load
		$.when.apply($,images).done(function() {

			// Generate SVG
			var data   = "<svg xmlns='http://www.w3.org/2000/svg' width='"+clone.outerWidth() + "' height='"+clone.outerHeight() + "'>" +
							"<foreignObject width='100%' height='100%'>" +
								"<body xmlns='http://www.w3.org/1999/xhtml' >" +
								"<style>"+templateCSS+"</style>" +
								clone[0].outerHTML+
								'</body>' +
						   '</foreignObject>' +
					//' <text y="90">" \' # % &amp; ¿ 🔣</text>'+
						'</svg>';
			//var svg = jQuery(data).appendTo('body')[0];
			var img = jQuery("<img src='data:image/svg+xml;base64,"+_svgEncode(data)+"'/>").appendTo('body')[0];

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
		});
	};

	/**
	 * Encode an SVG so we can further use it
	 *
	 * @param {String} svg
	 * @returns {String} Base64 encoded svg
	 */
	_svgEncode = function svgEncode(svg)
	{
		var txt = svg
        .replace('<svg',(~svg.indexOf('xmlns')?'<svg':'<svg xmlns="http://www.w3.org/2000/svg"'));

		return btoa(txt);
	};

	/**
	 * Download the given element as a file
	 * 
	 * @param {String} data objectURL or data url to download
	 * @param {String} filename
	 */
	_download: function _download(data, filename) {
		var pom = document.createElement('a');

		pom.setAttribute('href',data);
		pom.setAttribute('download', filename);
		
		if (document.createEvent) {
			var event = document.createEvent('MouseEvents');
			event.initEvent('click', true, true);
			pom.dispatchEvent(event);
		}
		else {
			pom.click();
		}
	};

	_message: function _message(message, type) {
		var stateClass = 'ui-state-highlight';
		var icon = 'ui-icon-info';
		if(type == 'error')
		{
			stateClass = 'ui-state-error';
			icon = 'ui-icon-alert';
		}
		var msg = '<div class="ui-widget"><span class="ui-icon ui-icon-close" style="float: right; margin-top: 2px; margin-right: 2px; "></span>'+
			'<div class="' + stateClass + ' ui-corner-all" style="margin-top: 20px; padding: 0 .7em;">' +
				'<p><span class="ui-icon '+ icon + '" style="float: left; margin-right: 0.3em; margin-top:0.3em;"></span>' +
				message + '</p></div></div>';

		jQuery(msg).appendTo(messageNode)
				.on('click','.ui-icon-close', function() {
					jQuery(this).parent().remove();
				});
		
	};

	/**
	 * Read and parse an iCal file from the provided remote URL
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
			if(event.attach)
			{
				_getAttachments(event);
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

				// We'll do the recurrences, but limited to 50
				if(recurring.length > RECUR_LIMIT)
				{
					_message('Recurrence limit hit (' + RECUR_LIMIT + ') on "' + event.summary.value +'"', 'error');
				}
				for(var j = 0; j < recurring.length && j < RECUR_LIMIT; j++)
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
	massageEvent = function massageEvent(event, template)
	{

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

			// For HTML - <br /> does not work inside SVG
			if(value.indexOf('\\n') !== -1)
			{
				value = '<p>'+value.replace(/\\n/g,'</p><p>')+'</p>';
			}
			event[fields[i]] = value;
		}
		return event;
	};

	/**
	 * Set the template for the slides
	 *
	 * The SVG needs the styles inlined, so we load just the particular CSS for
	 * the theme, and store it so we can stuff it into the SVG
	 *
	 * @param {String} template - Needs to match a css file in css/templates directory
	 * @returns {undefined}
	 */
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
				_message('Unable to load template ' + template, 'error');
			}
		};
		xhr.send();
	};

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
			if(!value) continue;

			switch(fields[i])
			{
				case 'attach':
					template.append('<div class="' + fields[i]+'" style="background-image: url(\'' + value + '\');"></div>');
					break;
				default:
					template.append('<span class="'+fields[i]+'">' + value + '</span>');
					break;
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
			_message(start.format(dateFormat) + ' - ' + end.format(dateFormat) + ': ' + events.length + ' events found');
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
				}, function() {_message('Unable to load ' + ical_url, 'error')});
		}
		else if (typeof ical_url.name === 'string')
		{
			readICalFile(ical_url, start, end)
				.then(function(events) {
					// Make slides
					_makeSlides(events);
				}, function() {_message('Unable to load file', 'error')});
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


