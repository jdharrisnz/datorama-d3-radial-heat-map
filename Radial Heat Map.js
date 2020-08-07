var radialHeatMap = {
  'initialize': function() {
    // Check if prefs have been set, and set if not
      if (typeof revolution == 'undefined') {
        revolution = 'month';
      }
      
      if (typeof weekdayShift == 'undefined') {
        weekdayShift = 1;
      }
      
      if (typeof monthsFullRevs == 'undefined') {
        monthsFullRevs = false;
      }
    
    // Don't do anything if query is invalid
      var query = DA.query.getQuery();
      if (Object.keys(query.fields).length === 0) {
        d3.select('#__da-app-content')
        .html('<h1>Just add data!</h1><p>Add data in your widget settings to start making magic happen.</p>');
        javascriptAbort();  // Garbage meaningless function to get the widget to stop processing
      }
      else if (Object.keys(query.fields.dimension).length != 1 ||
             !(query.fields.dimension.hasOwnProperty('DATE_DAY'))) {
        d3.select('#__da-app-content')
        .html('<h1>Invalid dimension selection.</h1><p>Select only Day for your dimension.</p>');
        javascriptAbort();  // Garbage meaningless function to get the widget to stop processing
      }
    
    // Store the query result
      var queryResult = DA.query.getQueryResult();
    
    // Replace all dates with JavaScript Date objects
      queryResult.rows.forEach(row => row[0].value = new Date(row[0].value));
    
    // Create an unbroken list of dates and set useful variables
      var minDate = d3.min(queryResult.rows.map(x => x[0].value));
      var maxDate = d3.max(queryResult.rows.map(x => x[0].value));
      var dateSpan = Math.round((maxDate - minDate)/(1000*60*60*24)) + 1;
      var dateList = [];
      for (i = 0; i < dateSpan; i++) {
        dateList.push(new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate() + i));
      }
      var months = Array.from(new Set(dateList.map(x => x.getFullYear() + ' ' + x.getMonth())));
      var years = Array.from(new Set(dateList.map(x => x.getFullYear())));
    
    // Create the structural elements
      var svgContainer = d3.select('#__da-app-content').append('div')
        .attr('id', 'svgContainer');
    
      var svg = svgContainer.append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', '0 0 1 1')
        .attr('preserveAspectRatio', 'xMidYMid meet');
      
      var legendContainer = d3.select('#__da-app-content').append('div')
        .attr('id', 'legendContainer');
    
      var legendWidth = 9 / 33;
      var legend = legendContainer.append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', '0 0 ' + legendWidth + ' 1')
        .attr('preserveAspectRatio', 'xMaxYMid meet');
    
      var tooltip = d3.select('#__da-app-content').append('div')
        .attr('id', 'tooltip')
        .style('display', 'none');
    
    // Work out some sizing stuff
      // Percentage of the visual to reserve for the middle text
      var reservedCenter = 0.45;
      
      // Percentage of the visual to reserve for the outside labels
      var em;
      svg.each(function() {
        var box = this.getBoundingClientRect();
        var minLength = d3.min([box.width, box.height]);
        d3.select('#__da-app-content').append('div')
          .style('position', 'absolute')
          .style('line-height', '1em')
          .text('A')
          .each(function() { em = this.getBoundingClientRect().height / minLength; })
          .remove();
      });
      var emGap = em * 0.5;
      var reservedOuter = (em * 2 + emGap) * 2;
    
    // Define functions for creating arc elements
      function getRadius(day, nextLevel) {
        var level, levels;
        if (revolution == 'week') {
          var tzOffset = (day.getTimezoneOffset() - minDate.getTimezoneOffset()) * 60 * 1000;
          level = Math.floor((day - tzOffset - minDate) / (1000*60*60*24) / 7);
          levels = Math.ceil(dateSpan / 7);
        }
        else if (revolution == 'month') {
          level = months.indexOf(day.getFullYear() + ' ' + day.getMonth());
          if (level == -1) { level = months.length; }
          levels = months.length;
        }
        else if (revolution == 'year') {
          level = years.indexOf(day.getFullYear());
          if (level == -1) { level = years.length; }
          levels = years.length;
        }
        
        if (nextLevel === true) { level++; }
        var levelAdjust = (1 - reservedCenter - reservedOuter) / 2 / levels * level;
        return (reservedCenter / 2) + levelAdjust;
      }
    
      function getAngle(day, nextDay) {
        if (revolution == 'week') {
          var weekday = day.getDay() - weekdayShift;
          if (nextDay === true) { weekday++; }
          return (360 / 7 * weekday - 90) * (Math.PI / 180);
        }
        else if (revolution == 'month') {
          var dayNum = day.getDate() - 1;
          if (nextDay === true) { dayNum ++; }
          var days = 31;
          if (monthsFullRevs === true) { days = new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate(); }
          return (360 / days * dayNum - 90) * (Math.PI / 180);
        }
        else if (revolution == 'year') { // The mess here deals with leap years
          var normalYearStart = new Date(2018, 0, 1);
          var normalMonthStart = new Date(2018, day.getMonth(), 1);
          var tzOffset = (normalMonthStart.getTimezoneOffset() - normalYearStart.getTimezoneOffset()) * 60*1000;
          var monthStartDay = (normalMonthStart - tzOffset - normalYearStart) / (1000*60*60*24);
          var daysInNormalMonth = new Date(normalMonthStart.getFullYear(), normalMonthStart.getMonth() + 1, 0).getDate();
          var daysInThisMonth = new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate();
          var daySizeAdjust = daysInNormalMonth / daysInThisMonth;
          var dayShift = day.getDate() - 1;
          if (nextDay === true) { dayShift++; }
          return ((360 / 365 * monthStartDay) + (360 / 365 * ((dayShift - 1) * daySizeAdjust)) - 90) * (Math.PI / 180);
        }
      }
    
    // Define some elements to be used later
      var defs = svg.append('defs');
    
      var markerDot = defs.append('marker')
        .attr('id', 'markerDot')
        .attr('viewBox', '0 0 2 2')
        .attr('refX', 1)
        .attr('refY', 1)
        .attr('markerUnits', 'userSpaceOnUse')
        .attr('markerWidth', 0.0125)
        .attr('markerHeight', 0.0125);
    
      markerDot.append('circle')
        .attr('cx', 1)
        .attr('cy', 1)
        .attr('r', 1);
    
      var markerArrow = defs.append('marker')
        .attr('id', 'markerArrow')
        .attr('viewBox', '0 0 1 2')
        .attr('refX', 0)
        .attr('refY', 1)
        .attr('markerUnits', 'userSpaceOnUse')
        .attr('markerWidth', 0.01)
        .attr('markerHeight', 0.02)
        .attr('orient', 'auto-start-reverse');
    
      markerArrow.append('path')
        .attr('d', 'M 0 2 L 1 1 L 0 0 Z');
    
    // Create the mask for data points transparency and gaps
      var mask = svg.append('mask')
        .attr('id', 'dataGaps');
    
      var gDataGaps = mask.append('g');
    
      // Create a function for computing data point paths
      function dataPath(day) {
        var path = [];
        path.push(['M', 0.5 + getRadius(day, false) * Math.cos(getAngle(day, false)), 0.5 + getRadius(day, false) * Math.sin(getAngle(day, false))].join(' '));
        path.push(['A', getRadius(day, false), getRadius(day, false), 0, 0, 1, 0.5 + getRadius(day, false) * Math.cos(getAngle(day, true)), 0.5 + getRadius(day, false) * Math.sin(getAngle(day, true))].join(' '));
        path.push(['L', 0.5 + getRadius(day, true) * Math.cos(getAngle(day, true)), 0.5 + getRadius(day, true) * Math.sin(getAngle(day, true))].join(' '));
        path.push(['A', getRadius(day, true), getRadius(day, true), 0, 0, 0, 0.5 + getRadius(day, true) * Math.cos(getAngle(day, false)), 0.5 + getRadius(day, true) * Math.sin(getAngle(day, false))].join(' '));
        return path.join(' ') + ' Z';
      }
    
      // Define the color scale for transparency
      var minShade = 'rgb(25, 25, 25)';  // Equivalent to 0.1 opacity at lowest level
      var colorScale = d3.scaleLinear()
        .domain(d3.extent(queryResult.rows.map(x => x[1].value)))
        .range([minShade, 'rgb(255, 255, 255)']);
    
      // Create the masker elements
      var dataGaps = gDataGaps.selectAll('path')
      .data(queryResult.rows)
      .join('path')
        .style('fill', d => colorScale(d[1].value))
        .style('stroke', () => { if (revolution != 'year') { return 'black'; } })
        .style('stroke-width', () => { if (revolution != 'year') { return '1px'; } })
        .style('vector-effect', () => { if (revolution != 'year') { return 'non-scaling-stroke'; } })
        .attr('d', d => dataPath(d[0].value));
    
    // Create the visible data points
      var gDataPoints = svg.append('g')
        .attr('mask', 'url(#dataGaps)');
    
      var dataPoints = gDataPoints.selectAll('path')
      .data(queryResult.rows)
      .join('path')
        .attr('class', 'dataPoint')
        .attr('d', d => dataPath(d[0].value))
        .on('mouseenter', function(d) {
          tooltip
          .style('display', 'initial')
          .selectAll('div')
          .data(() => {
            data = [];
            data.push([{'name': null, 'class': null}, {'name': d[0].value.toDateString(), 'class': 'date'}]);
            for (i = 1; i < d.length; i++) {
              data.push([{'name': queryResult.fields[i].name + ': ', 'class': 'label'}, {'name': d[i].formattedValue, 'class': 'value'}]);
            }
            return data;
          })
          .join('div')
            .selectAll('span')
            .data(d => d)
            .join('span')
              .attr('class', d => d.class)
              .text(d => d.name);
        })
        .on('mousemove', function() {
          box = tooltip.node().getBoundingClientRect();
          svgMouse = d3.mouse(svg.node());
          mX = d3.event.pageX; mY = d3.event.pageY;
          if (svgMouse[0] > 0.5) { tooltip.style('left', mX - box.width - 2.5 + 'px'); }
          else { tooltip.style('left', mX + 12.5 + 'px'); }
          
          if (svgMouse[1] > 0.5) { tooltip.style('top', mY - box.height - 2.5 + 'px'); }
          else { tooltip.style('top', mY + 'px'); }
        })
        .on('mouseleave', function() {
          tooltip.style('display', 'none');
        });
    
    // Draw the reference start arrow
      var startArrow = svg.append('path')
        .attr('id', 'startArrow')
        .attr('marker-start', 'url(#markerDot)')
        .attr('marker-end', 'url(#markerArrow)')
        .attr('d', () => {
          var gap = em * 0.5;
          var path = [];
          path.push(['M', 0.5 + (getRadius(minDate, false) - gap) * Math.cos(getAngle(minDate, false)), 0.5 + (getRadius(minDate, false) - gap) * Math.sin(getAngle(minDate, false))].join(' '));
          path.push(['A', (getRadius(minDate, false) - gap), (getRadius(minDate, false) - gap), 0, 0, 1, 0.5 + (getRadius(minDate, false) - gap) * Math.cos(getAngle(minDate, false) + 1.5), 0.5 + (getRadius(minDate, false) - gap) * Math.sin(getAngle(minDate, false) + 1.5)].join(' '));
          return path.join(' ');
        });
    
    // Draw the outside labels
      var gLabels = svg.append('g');
    
      // Generate data for label arcs
      function getLabelLinesData() {
        var result = [];
        if (revolution == 'week') {
          for (i = 0; i < 7; i++) {
            result.push(new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate() + (Math.ceil(dateSpan / 7) * 7) + i));
          }
        }
        else if (revolution == 'month') {
          for (i = 0; i < 5; i++) {
            result.push(new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 1 + 7 * i));
          }
        }
        else if (revolution == 'year') {
          for (i = 0; i < 12; i++) {
            result.push(new Date(maxDate.getFullYear() + 1, i, 1));
          }
        }
        return result;
      }
    
      // Draw the label path arcs
      var labelLines = gLabels.selectAll('path')
      .data(getLabelLinesData())
      .join('path')
        .attr('id', (d, i)  => 'labelLine-' + i)
        .attr('class', 'labelLine')
        .attr('d', (d, i) => {
          var lineGap = 0.015; // Percentage gap between lines
          var path = [];
          path.push(['M', 0.5 + (getRadius(d, false) + em) * Math.cos(getAngle(d, false) + lineGap), 0.5 + (getRadius(d, false) + em) * Math.sin(getAngle(d, false) + lineGap)].join(' '));
          if (revolution == 'week') {
            path.push(['A', getRadius(d, false) + em, getRadius(d, false) + em, 0, 0, 1, 0.5 + (getRadius(d, false) + em) * Math.cos(getAngle(d, true) - lineGap), 0.5 + (getRadius(d, false) + em) * Math.sin(getAngle(d, true) - lineGap)].join(' '));
          }
          else if (revolution == 'month') {
            if (i == 4) {
              var day = new Date(d.getFullYear(), d.getMonth() + 1, 1);
              path.push(['A', getRadius(day, false) + em, getRadius(day, false) + em, 0, 0, 1, 0.5 + (getRadius(day, false) + em) * Math.cos(getAngle(day, false) - lineGap), 0.5 + (getRadius(day, false) + em) * Math.sin(getAngle(day, false) - lineGap)].join(' '));
            }
            else {
              var day = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7);
              path.push(['A', getRadius(day, false) + em, getRadius(day, false) + em, 0, 0, 1, 0.5 + (getRadius(day, false) + em) * Math.cos(getAngle(day, false) - lineGap), 0.5 + (getRadius(day, false) + em) * Math.sin(getAngle(day, false) - lineGap)].join(' '));
            }
          }
          else if (revolution == 'year') {
            var day = new Date(d.getFullYear(), d.getMonth() + 1, d.getDate());
            path.push(['A', getRadius(day, false) + em, getRadius(day, false) + em, 0, 0, 1, 0.5 + (getRadius(day, false) + em) * Math.cos(getAngle(day, false) - lineGap), 0.5 + (getRadius(day, false) + em) * Math.sin(getAngle(day, false) - lineGap)].join(' '));
          }
          return path.join(' ');
        });
    
      // Write text around the arcs
      var labelText = gLabels.selectAll('text')
      .data(getLabelLinesData())
      .join('text')
        .attr('class', 'labelText')
        .style('font-size', em)
        .attr('dy', -emGap)
        .append('textPath')
          .attr('href', (d, i) => '#labelLine-' + i)
          .attr('startOffset', '50%')
          .text((d, i) => {
            if (revolution == 'week') {
              return d.toLocaleString('default', { weekday: 'short' }).toUpperCase();
            }
            else if (revolution == 'month') {
              return 'WEEK ' + (i + 1);
            }
            else if (revolution == 'year') {
              return d.toLocaleString('default', { month: 'short' }).toUpperCase();
            }
        });
    
    // Label the center of the visual
      var gCenterText = svg.append('g');
    
      var centerText = gCenterText.append('text')
        .attr('class', 'centerText')
        .style('text-anchor', 'middle')
        .attr('x', 0.5)
        .attr('y', 0.5);
    
      // Write the text
      var centerTextSpan = centerText.selectAll('tspan')
      .data([queryResult.totals[0].data[0][0], queryResult.fields[1].name])
      .join('tspan')
        .attr('x', 0.5)
        .attr('dy', (d, i) => [null, em * 1.2 * 1.2][i])
        .attr('font-size', (d, i) => [em * 2, em * 1.2][i])
        .text(d => d);
    
      // Adjust the size to fit
      var centerTextAdjust;
      centerText.each(function() {
        var svgBox;
        svg.each(function() { svgBox = this.getBoundingClientRect(); });
        var svgBoxMinLength = d3.min([svgBox.width, svgBox.height]);
        
        var textBox = this.getBoundingClientRect();
        var textBoxMaxLength = d3.max([textBox.width, textBox.height]);
        
        centerTextAdjust = (textBoxMaxLength / svgBoxMinLength) / (reservedCenter - em * 3);
      });
    
      centerTextSpan
      .attr('dy', function(d, i) { if (i == 1) { return d3.select(this).attr('dy') / centerTextAdjust; }})
      .attr('font-size', function(d, i) { return d3.select(this).attr('font-size') / centerTextAdjust; });
    
    // Create the legend
      // Define the gradient
      var legendDefs = legend.append('defs');
    
      var legendGradient = legendDefs.append('linearGradient')
        .attr('id', 'legendGradient')
        .attr('x1', '0%').attr('x2', '0%')
        .attr('y1', '100%').attr('y2', '0%');
    
      legendGradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', minShade).attr('stop-opacity', 1);
    
      legendGradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', 'rgb(255, 255, 255)').attr('stop-opacity', 1);
    
      // Create the mask
      var legendMask = legend.append('mask')
        .attr('id', 'legendMask');
    
      legendMask.append('rect')
        .attr('x', legendWidth - em)
        .attr('y', 0 + em * 2 + emGap)
        .attr('width', em)
        .attr('height', 1 - (em * 2 + emGap) * 2)
        .style('fill', 'url(#legendGradient)');
    
      // Create the color scale rect
      var legendRect = legend.append('rect')
        .attr('id', 'legendRect')
        .attr('mask', 'url(#legendMask)')
        .attr('x', legendWidth - em)
        .attr('y', 0 + em * 2 + emGap)
        .attr('width', em)
        .attr('height', 1 - (em * 2 + emGap) * 2)
        .attr('rx', em / 2)
        .attr('ry', em / 2);
    
      // Define a scaler for the ticks
      var legendScale = d3.scaleLinear()
        .domain(d3.extent(queryResult.rows.map(x => x[1].value)))
        .range([1 - em * 2 - emGap, 0 + em * 2 + emGap]);
    
      // Draw the ticks
      var legendTicks = legend.selectAll('line')
      .data(queryResult.rows.map(x => x[1]).sort((a, b) => a.value - b.value))
      .join('line')
        .attr('class', 'legendTick')
        .attr('x1', legendWidth - em * 2).attr('x2', legendWidth - em * 1.5)
        .attr('y1', d => legendScale(d.value))
        .attr('y2', d => legendScale(d.value));
    
      // Define functions to retrieve the tick labels
      function getPctItemIndex(data, pct) {
        var index;
        var min = d3.min(data);
        var max = d3.max(data);
        var target = (max - min) * pct;
        var nearest = max;
        data.forEach((datum, i) => {
          var thisProximity = Math.abs(target - (datum - min));
          if (thisProximity < nearest) {
            nearest = thisProximity;
            index = i;
          }
        });
        return index;
      }
    
      function dataDistribution(data) {
        var dataSorted = data.sort((a, b) => a.value - b.value);
        var result = [];
        result.push(dataSorted[0]);
        result.push(dataSorted[getPctItemIndex(dataSorted.map(x => x.value), 0.25)]);
        result.push(dataSorted[getPctItemIndex(dataSorted.map(x => x.value), 0.50)]);
        result.push(dataSorted[getPctItemIndex(dataSorted.map(x => x.value), 0.75)]);
        result.push(dataSorted[dataSorted.length - 1]);
        return result;
      }
    
      // Create the labels
      var legendLabels = legend.selectAll('text')
      .data(dataDistribution(queryResult.rows.map(x => x[1])))
      .join('text')
        .attr('class', 'legendLabel')
        .style('font-size', em)
        .attr('x', legendWidth - em * 2.4)
        .attr('y', d => legendScale(d.value) + em / 1.25 / 2)
        .text(d => d.formattedValue);
  }
};