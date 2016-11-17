# iCal-Slides
Create images to be used as slides from the events in an iCal file

Online demo:
https://nathangray.github.io/iCal-Slides/


##How it works

To generate the slides, it takes a few steps.

###Parse the iCal

Thanks to the iCal Parser library (see requirements), parsing the file into objects is easy. Some special consideration is needed for recurring events, which is why RRule is used. The event information for each recurrence in the time frame is copied, with the appropriate date changes.

###Generate the slides

For each event, the slides are generated in the page DOM as HTML elements, and styled using the theme's CSS. You can right-click on the thumbnail to inspect the parts - it's just a div.

###Generate the image

This is the impossible part. When you click on the thumbnail, an image file is generated and downloaded. To go from DOM Nodes to an image file, first an SVG is created, using foreignObject to inline the slide's nodes. It's style is also inlined, including the background image - this is important, otherwise we end up with just text at the top of the image. The SVG is then converted to PNG, and the browser is told to download the PNG file.

##Requirements

If you want to download and run it locally, it must be served - it cannot be run straight from the filesystem or you'll get security errors, and the downloaded images will not look right. This script requires:

iCal Parser - https://github.com/peterbraden/ical.js (copied & included)  
RRule & NLP - https://github.com/jkbrzt/rrule (copied & included)  
jQuery - http://jquery.com  
jQueryUI - http://jqueryui.com  
Moment - http://momentjs.com  
Moment Interval - https://github.com/luisfarzati/moment-interval  
