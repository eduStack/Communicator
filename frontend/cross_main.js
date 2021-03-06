var secretUsername = 'your secret username';
var secretPassword = 'your secret pass';

window.filterLimits = {
  'certification-chart': [0, 100],
  'attrition-chart': [0, 100],
  'completion-chart': [0, 100]
};

function drawGraphs(dataUrl, json) {
  if (json) {
    d3.json(dataUrl);
  } else {
    d3.csv(dataUrl).header("Authorization", "Basic " + btoa(secretUsername + ":" + secretPassword)).get(loadData);
  }
}

function loadData(error, students) {
  if (error) {
    console.log(error);
    alert("Could not load student data");
    return;
  }
  // Various formatters
  var formatNumber = d3.format(",d"),
      formatChange = d3.format("+,d"),
      formatDate = d3.time.format("%B %d, %Y"),
      formatTime = d3.time.format("%I:%M %p");

  // A nest operator
  var nestByDate = d3.nest()
      .key(function(d) { return 'Test'; });

  // A little coercion, since the CSV is untyped.
  students.forEach(function(d, i) {
    d.index = i;
    d.completion_prediction = +d.completion_prediction;
    d.attrition_prediction = +d.attrition_prediction;
    d.certification_prediction = +d.certification_prediction;
  });

  // Create the crossfilter for the relevant dimensions and groups.
  var student = crossfilter(students),
      all = student.groupAll(),
      anon_user_id = student.dimension(function(d) {return d.anon_user_id; }),
      completion = student.dimension(function(d) {return d.completion_prediction; }),
      attrition = student.dimension(function(d) {return d.attrition_prediction; }),
      certification = student.dimension(function(d) {return d.certification_prediction; }),
      completions = completion.group(Math.floor),
      attritions = attrition.group(Math.floor),
      certifications = certification.group(Math.floor);

  var charts = [

    barChart()
        .dimension(completion)
        .group(completions)
      .x(d3.scale.linear()
        .domain([0, 100])
        .rangeRound([0, 900])),

    barChart()
        .dimension(attrition)
        .group(attritions)
      .x(d3.scale.linear()
        .domain([0, 100])
        .rangeRound([0, 900])),

    barChart()
        .dimension(certification)
        .group(certifications)
      .x(d3.scale.linear()
        .domain([0, 100])
        .rangeRound([0, 900]))
  ];

  var chart = d3.selectAll(".chart")
      .data(charts)
      .each(function(chart) { chart.on("brush", renderAll).on("brushend", renderAll); });

  // Render the initial lists.
  var list = d3.selectAll(".list")
      .data([studentList]);

  // Render the total.
  d3.selectAll("#total")
      .text(formatNumber(student.size()));

  renderAll();

  // Make all learners receipients always be all students
  d3.select("#all-recipients").text("Recipients: " + formatNumber(student.size()) + " Learners");

  // Renders the specified chart or list.
  function render(method) {
    d3.select(this).call(method);
  }

  // Whenever the brush moves, re-rendering everything.
  function renderAll() {
    chart.each(render);
    list.each(render);
    d3.select("#active").text(formatNumber(all.value()));
    d3.select("#percentage").text(" (" + formatNumber(Math.round(all.value() * 100.0 / student.size())) + "%)");
    d3.select("#recipients").text("Recipients: " + formatNumber(all.value()) + " Learners");
  }

  // Like d3.time.format, but faster.
  function parseDate(d) {
    return new Date(2001,
        d.substring(0, 2) - 1,
        d.substring(2, 4),
        d.substring(4, 6),
        d.substring(6, 8));
  }

  window.filter = function(filters) {
    filters.forEach(function(d, i) { charts[i].filter(d); });
    renderAll();
  };

  window.reset = function(i) {
    charts[i].filter(null);
    renderAll();
  };

  function studentList(div) {
    window.selectedStudents = anon_user_id.top(Infinity);
    var studentsByDate = nestByDate.entries(anon_user_id.top(Infinity));
    div.each(function() {
      var date = d3.select(this).selectAll(".all-students")
          .data(studentsByDate, function(d) { return d.key; });

      date.enter().append("div")
          .attr("class", "all-students")
        .append("div")
          .attr("class", "day")
          .text(function(d) { return ""; });

      date.exit().remove();

      var student = date.order().selectAll(".student")
          .data(function(d) { return d.values; }, function(d) { return d.index; });

      var studentEnter = student.enter().append("div")
          .attr("class", "student");

      studentEnter.append("div")
          .attr("class", "anon-student")
          .text(function(d) { return d.anon_user_id; });

      studentEnter.append("div")
          .attr("class", "completion")
          .text(function(d) { return d.completion_prediction; });

      studentEnter.append("div")
          .attr("class", "attrition")
          .text(function(d) { return d.attrition_prediction; });

      studentEnter.append("div")
          .attr("class", "certification")
          .text(function(d) { return d.certification_prediction; });

      student.exit().remove();

      student.order();
    });
  }

  function barChart() {
    if (!barChart.id) barChart.id = 0;

    var margin = {top: 10, right: 10, bottom: 20, left: 10},
        x,
        y = d3.scale.linear().range([100, 0]),
        id = barChart.id++,
        axis = d3.svg.axis().orient("bottom"),
        brush = d3.svg.brush(),
        brushDirty,
        dimension,
        group,
        round;

    function chart(div) {
      var width = x.range()[1],
          height = y.range()[0];

      y.domain([0, group.top(1)[0].value]);

      div.each(function() {
        var div = d3.select(this),
            g = div.select("g");

        // Create the skeletal chart.
        if (g.empty()) {
          div.select(".title").append("a")
              .attr("href", "javascript:reset(" + id + ")")
              .attr("class", "reset")
              .text("reset")
              .style("display", "none");

          g = div.append("svg")
              .attr("width", width + margin.left + margin.right)
              .attr("height", height + margin.top + margin.bottom)
            .append("g")
              .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

          g.append("clipPath")
              .attr("id", "clip-" + id)
            .append("rect")
              .attr("width", width)
              .attr("height", height);

          g.selectAll(".bar")
              .data(["background", "foreground"])
            .enter().append("path")
              .attr("class", function(d) { return d + " bar"; })
              .datum(group.all());

          g.selectAll(".foreground.bar")
              .attr("clip-path", "url(#clip-" + id + ")");

          g.append("g")
              .attr("class", "axis")
              .attr("transform", "translate(0," + height + ")")
              .call(axis);

          // Initialize the brush component with pretty resize handles.
          var gBrush = g.append("g").attr("class", "brush").call(brush);
          gBrush.selectAll("rect").attr("height", height);
          gBrush.selectAll(".resize").append("path").attr("d", resizePath);
        }

        // Only redraw the brush if set externally.
        if (brushDirty) {
          brushDirty = false;
          g.selectAll(".brush").call(brush);
          div.select(".title a").style("display", brush.empty() ? "none" : null);
          if (brush.empty()) {
            g.selectAll("#clip-" + id + " rect")
                .attr("x", 0)
                .attr("width", width);
          } else {
            var extent = brush.extent();
            g.selectAll("#clip-" + id + " rect")
                .attr("x", x(extent[0]))
                .attr("width", x(extent[1]) - x(extent[0]));
          }
        }

        g.selectAll(".bar").attr("d", barPath);
      });

      function barPath(groups) {
        var path = [],
            i = -1,
            n = groups.length,
            d;
        while (++i < n) {
          d = groups[i];
          path.push("M", x(d.key), ",", height, "V", y(d.value), "h9V", height);
        }
        return path.join("");
      }

      function resizePath(d) {
        var e = +(d == "e"),
            x = e ? 1 : -1,
            y = height / 3;
        return "M" + (.5 * x) + "," + y
            + "A6,6 0 0 " + e + " " + (6.5 * x) + "," + (y + 6)
            + "V" + (2 * y - 6)
            + "A6,6 0 0 " + e + " " + (.5 * x) + "," + (2 * y)
            + "Z"
            + "M" + (2.5 * x) + "," + (y + 8)
            + "V" + (2 * y - 8)
            + "M" + (4.5 * x) + "," + (y + 8)
            + "V" + (2 * y - 8);
      }
    }

    brush.on("brushstart.chart", function() {
      var div = d3.select(this.parentNode.parentNode.parentNode);
      div.select(".title a").style("display", null);
    });

    brush.on("brush.chart", function() {
      var g = d3.select(this.parentNode),
          extent = brush.extent();
      if (round) g.select(".brush")
          .call(brush.extent(extent = extent.map(round)))
        .selectAll(".resize")
          .style("display", null);
      g.select("#clip-" + id + " rect")
          .attr("x", x(extent[0]))
          .attr("width", x(extent[1]) - x(extent[0]));
      dimension.filterRange(extent);
      // Get name of chart and limits for that chart
      window.filterLimits[g.node().parentNode.parentNode.id] = extent;
    });

    brush.on("brushend.chart", function() {
      if (brush.empty()) {
        var div = d3.select(this.parentNode.parentNode.parentNode);
        div.select(".title a").style("display", "none");
        div.select("#clip-" + id + " rect").attr("x", null).attr("width", "100%");
        dimension.filterAll();
      }
    });

    chart.margin = function(_) {
      if (!arguments.length) return margin;
      margin = _;
      return chart;
    };

    chart.x = function(_) {
      if (!arguments.length) return x;
      x = _;
      axis.scale(x);
      brush.x(x);
      return chart;
    };

    chart.y = function(_) {
      if (!arguments.length) return y;
      y = _;
      return chart;
    };

    chart.dimension = function(_) {
      if (!arguments.length) return dimension;
      dimension = _;
      return chart;
    };

    chart.filter = function(_) {
      if (_) {
        brush.extent(_);
        dimension.filterRange(_);
      } else {
        brush.clear();
        dimension.filterAll();
      }
      brushDirty = true;
      return chart;
    };

    chart.group = function(_) {
      if (!arguments.length) return group;
      group = _;
      return chart;
    };

    chart.round = function(_) {
      if (!arguments.length) return round;
      round = _;
      return chart;
    };

    return d3.rebind(chart, brush, "on");
  }
}
