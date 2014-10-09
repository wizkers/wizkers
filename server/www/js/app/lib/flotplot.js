/*
 * A generic Flot plot, do be used by any instrument that requires it
 * 
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */

define(function(require) {
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone');
    
        // Load the flot library & flot time plugin:
    require('flot');
    require('flot_time');

    return Backbone.View.extend({
        
        // Here are all the options we can define, to pass as "settings" when creating the view:        
        settings: {
            points: 150,
            log: false,
            showtips: true,
            get: function(key) {
                return this[key];
            },
        },
            
        initialize:function (options) {
            // Replace defaults by our own config for all keys
            // passed - if any
            if (options && options.settings) {
                for (var prop in options.settings) {
                    this.settings[prop] = options.settings[prop];
                }
            }
                        
            // livedata is an array of all readings.
            // We can have multiple values plotted on the chart, so this is
            // an array of arrays.
            this.livedata = [[]];
            this.sensors = [];
            this.plotData = [];
            this.previousPoint = null;
            
            // My own nice color palette:
            this.palette = ["#e27c48", "#5a3037", "#f1ca4f", "#acbe80", "#77b1a7", "#858485", "#d9c7ad" ];

            this.plotOptions = {
                xaxis: { mode: "time", show:true, timezone: settings.get("timezone")},
                grid: {
                    hoverable: true,
                    clickable: true
                },
                legend: { position: "ne", container: $('#legend') },
                colors: this.palette,
            };

        },

        render: function () {
            console.log("Rendering a simple chart widget");
            $(this.el).html('<div class="chart" style="position: relative; min-height: 200px;"></div>');
            this.addPlot();
            return this;
        },
            
        addPlot: function() {
            var self=this;
            // Now initialize the plot area:
            // this.plotOptions.legend = { container: $('#legend',this.el) };
            this.plot = $.plot($(".chart", this.el), [ {data:[], label:"??", color:this.color} ], this.plotOptions);

            // Adjust whether we want a log display, or linear (setup in global settings)
            if (settings.get('cpmscale')=="log") {
                this.plotOptions.yaxis = {
                            min:1,
                            //ticks: [1,10,30,50,100,500,1000,1500],
                            transform: function (v) { return Math.log(v+10); },
                            inverseTransform: function (v) { return Math.exp(v)-10;}
                        };
            } else if ('yaxis' in this.plotOptions){
                delete this.plotOptions.yaxis.min;
                delete this.plotOptions.yaxis.transform;
                delete this.plotOptions.yaxis.inverseTransform;
            }

            // Add Tooltips
            if (!this.settings.showtips)
                return;
            
            $(".chart", this.el).bind("plothover", function (event, pos, item) {
                if (item) {
                        $("#tooltip").remove();
                        var x = item.datapoint[0],
                            y = item.datapoint[1];

                        self.showTooltip(item.pageX, item.pageY,
                            "<small>" + ((self.settings.get('timezone') === 'UTC') ? 
                                            new Date(x).toUTCString() :
                                            new Date(x).toString()) + "</small><br>" + item.series.label + ": <strong>" + y + "</strong>");
                } else {
                    $("#tooltip").remove();
                }
            });

        },
        
        // Ugly at this stage, just to make it work (from flotcharts.org examples)
        showTooltip: function (x, y, contents) {
                $("<div id='tooltip' class='well'>" + contents + "</div>").css({
                    position: "absolute",
                    display: "none",
                    top: y + 5,
                    left: x + 5,
                    padding: "3px",
                    opacity: 0.90
                }).appendTo("body").fadeIn(200);
        },

        
        trimLiveData: function(idx) {
            if (this.livedata[idx].length >= this.settings.points) {
                    this.livedata[idx] = this.livedata[idx].slice(1);
            }
        },
        
        // Append a data point. Data should be in the form of
        // { name: "measurement_name", value: value } or
        // { name: "measurement°name", value: value, timestamp: timestamp }
        fastAppendPoint: function(data) {
            var sensor = data.name;
            var idx = this.sensors.indexOf(sensor);
            if (idx == -1) {
                this.sensors.push(sensor);
                this.livedata.push([]);
                idx = this.sensors.length-1;
            }
            if (this.settings.points) this.trimLiveData(idx);
            var stamp = (data.timestamp) ? new Date(data.timestamp).getTime(): new Date().getTime();
            this.livedata[idx].push([stamp, data.value]);
        },
        
        redraw: function() {
            var plotData = [];
            // Now pack our live data:
            for (var i = 0; i < this.sensors.length; i++) {
                plotData.push( { data: this.livedata[i],
                                 label: this.sensors[i]} );
            }        
            // Now update our plot
            this.plot.setData(plotData);
            this.plot.setupGrid();
            this.plot.draw();
        },
        
        // This method forces a redraw and is slow: use fastAppendPoint for
        // loading a large number of points before redrawing
        appendPoint: function(data) {
            this.fastAppendPoint(data);
            this.redraw();
        }    
            
    });

});

    
