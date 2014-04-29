// Live view for the W433 sensor
// 
// Our model is the settings object.
//
// (c) 2014 Edouard Lafargue, ed@lafargue.name

define(function(require) {
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        tpl     = require('text!tpl/instruments/W433LiveView.html'),
        template = null;
    
        try {
            template =  _.template(tpl);
        } catch (e) {
            // Will happen if we are packaged in a Chrome app
            console.log('W433Settings View: using compiled version (chrome app)');
            template = require('js/tpl/instruments/W433LiveView.js', function(){} , function(err) {
                            console.log("Compiled JS preloading error callback.");
                            });
        }

    // Load the flot library & flot time plugin:
    require('flot');
    require('flot_time');

    return Backbone.View.extend({

        initialize:function (options) {
            this.settings = this.model;

            linkManager.on('input', this.showInput, this);

            this.livepoints = Math.floor(Number(this.settings.get('liveviewspan'))/Number(this.settings.get('liveviewperiod')));
            // livedata is an array of all readings by detected sensors
            this.livedata = [[]];
            this.sensors = [];
            this.plotData = [];
            this.previousPoint = null;

            // TODO: save color palette in settings ?
            // My own nice color palette:
            this.palette = ["#e27c48", "#5a3037", "#f1ca4f", "#acbe80", "#77b1a7", "#858485", "#d9c7ad" ];


            this.plotOptions = {
                xaxis: { mode: "time", show:true, timezone: this.model.get("timezone") },
                grid: {
                    hoverable: true,
                    clickable: true
                },
                legend: { position: "ne", container: $('#legend') },
                colors: this.palette,
            };
        },

        render:function () {
            $(this.el).html(template());
            this.addPlot();

            return this;
        },

        addPlot: function() {
            var self=this;
            // Now initialize the plot area:
        this.plotOptions.legend = { container: $('#legend',this.el) };
            this.plot = $.plot($(".datachart", this.el), [ {data:[], label:"??", color:this.color} ], this.plotOptions);

            $(".datachart", this.el).bind("plothover", function (event, pos, item) {
                if (item) {
                        $("#tooltip").remove();
                        var x = item.datapoint[0],
                            y = item.datapoint[1];

                        self.showTooltip(item.pageX, item.pageY,
                            "<small>" + ((settings.get('timezone') === 'UTC') ? 
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




        onClose: function() {
            console.log("W433 Live view closing");
            linkManager.off('input', this.showInput, this);
        },


        // We get there whenever we receive something from the serial port
        showInput: function(data) {
            // Update our raw data monitor
            var i = $('#input',this.el);
            var scroll = (i.val() + JSON.stringify(data) + '\n').split('\n');
            // Keep max 50 lines:
            if (scroll.length > 50) {
                scroll = scroll.slice(scroll.length-50);
            }
            i.val(scroll.join('\n'));
            // Autoscroll:
            i.scrollTop(i[0].scrollHeight - i.height());

            // Now add the current sensor
            var sensor =data.sensor_name + " - " + data.reading_type;
            if (this.sensors.indexOf(sensor) == -1) {
                this.sensors.push(sensor);
                this.livedata.push([]);
            }
            var idx = this.sensors.indexOf(sensor);
            this.trimLiveData(idx);
            this.livedata[idx].push([new Date().getTime(), data.value]);

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

        trimLiveData: function(idx) {
            if (this.livedata[idx].length >= this.livepoints) {
                    this.livedata[idx] = this.livedata[idx].slice(1);
            }
        },
    });
    
});