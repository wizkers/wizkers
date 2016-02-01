/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
 */

/*
 * A Wind rose Flot plot, do be used by any instrument that requires it
 *
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function(require) {
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone');
    
    // Load the flot library & flot time plugin:
    require('flot');
    require('flot_resize');
    require('flot_windrose');

    return Backbone.View.extend({
        
        // Here are all the options we can define, to pass as "settings" when creating the view:        
        settings: {
            points: 150,
            instant: true,    // Add a small pointer showing current/instant wind direction
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
            this.livedata = [];
            this.previousPoint = null;
            
            this.plotOptions = {
                series:{
                    rose:{  active:true,
                            roseSize:0.8,
                            leafSize:0.5,
                            drawGrid:{
                                gridMode: "ticks",
                                labelPos: 0.5,
                                drawValue: true
                            } 
                        }
                },
                grid:{
                    hoverable: true,
                    clickable: true, 
                    tickLabel:["N","NNE","NE","ENE","E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW" ]
                }
            };
            
            
        },

        render: function () {
            console.log("Rendering a flow wind rose widget");
            this.$el.html('<div class="chart" style="position: relative; min-height: 350px;"></div>');
            this.addPlot();
            return this;
        },
            
        addPlot: function() {
            var d1 = [ 1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1];
            var data = [
                { label: "8+",  color:"red", data: d1, rose: {show: true } },
                { label: "4-7", color:{colors:["yellow","orange","red"] }, data: d1, rose: {show: true } },
                { label: "1-3", color:"green", data: d1, rose: {show: true} }
            ];
            
            this.plot = $.plot($(".chart", this.el),data, this.plotOptions);
            
        },
                
        trimLiveData: function() {
            if (this.livedata.length >= this.settings.points) {
                    this.livedata = this.livedata.slice(1);
            }
        },
        
        // Append a data point. Data should be in the form of
        // { name: "measurement_name", value: { dir: dir, speed: speed} } or
        // { name: "measurement_name", value:{ dir: dir, speed: speed}, timestamp: timestamp }
        fastAppendPoint: function(data) {
            if (this.settings.points) this.trimLiveData();
            var stamp = (data.timestamp) ? new Date(data.timestamp).getTime(): new Date().getTime();
            this.livedata.push({stamp: stamp, dir: data.value.dir, speed: data.value.speed});
        },
        
        redraw: function() {
            if (this.livedata.length < 2)
               return;
            var force13 = [ 1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]; // Wind < 10 knt
            var force47 = [ 1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]; // Wind < 33 knt
            var force8p = [ 1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], // Wind > 33 knt
                latest = 0;
            // Now pack our live data:
            for (var i = 1; i < this.livedata.length; i++) {
                var data = this.livedata[i-1];
                var duration = this.livedata[i].stamp - data.stamp;
                var dir = data.dir/22.5;
                if (data.speed < 10) {
                    force13[dir] += duration;
                } else if (data.speed < 33) {
                    force47[dir] += duration;
                } else {
                    force8p[dir] += duration;
                }
            }
            var timespan = this.livedata[this.livedata.length-1].stamp - this.livedata[0].stamp;
            // Then stack the data
            for (var i = 0; i < 16; i++) {
                force13[i] = force13[i]/timespan*100;
                force47[i] = force47[i]/timespan*100;
                force8p[i] = force8p[i]/timespan*100;
                force47[i] += force13[i];
                force8p[i] += force47[i];
            }
            
            
            // Get the latest wind speed in the live data, to draw a nice pointer around it:
            if (this.settings.instant) {
                latest = this.livedata[this.livedata.length-1].dir;
            }
            // Last, format it nicely;
            var data = [
                { label: "8+",   color:"red", data: force8p, rose: {show: true } },
                { label: "4-7",  color:{colors:["yellow","orange","red"] }, data: force47, rose: {show: true } },
                { label: "1-3",  color:"green", data: force13, rose: {show: true} },
                { color:"blue", data: [ latest ], rose: {show: this.settings.instant, pointer: true} }
            ];
            // Now update our plot
            this.plot.setData(data);
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

    
