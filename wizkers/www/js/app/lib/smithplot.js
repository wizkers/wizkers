/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2016 Edouard Lafargue, ed@wizkers.io
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software
 * is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
 * IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/*
 * A generic Flot plot, do be used by any instrument that requires it
 *
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        utils = require('app/utils'),
        Backbone = require('backbone'),
        paper = require('paper');


    return (function() {

        var view;
        var r0 = 50;
        var x0 = 0;

        // Here are all the options we can define, to pass as "settings" when creating the view:
        var smithplot_settings = {
            // points: 150,
            // duration: 600,  // Max age of datapoints in seconds (older will be removed)
            // preload: 4096,  // Use this when creating a plot with a fixed number of data points
            // (used for the Sigma-25)
            // log: false,     // Override log display
            showtips: true,
            selectable: false,
            vertical_stretch: true, // Stretch relative to window height
            vertical_stretch_parent: false, // Stretch relative to parent height
            multiple_yaxis: false,
            plot_options: {
            },

            get: function (key) {
                return this[key];
            },
        };

        // Utility class: normalizes the Paper surface to a
        // coordinate system of our choosing, with zero at the
        // center
        function coordNormalizer(cWidth, cHeight) {


            var matrix;
            var maxx = 10;
            var minx = -10;
            var maxy = 10;
            var miny = -10;
            var canvasWidth = cWidth;
            var canvasHeight = cHeight;

            var normalize = function () {
                var left = minx;
                var top = maxy;
                var width = maxx - minx;
                var height = -(maxy - miny);

                var px = ((0 - left) / width) * canvasWidth;
                var py = ((0 - top) / height) * canvasHeight;

                var sx = (1 / width) * canvasWidth;
                var sy = (1 / height) * canvasHeight;

                matrix = new paper.Matrix(sx, 0, 0, sy, px, py);
            };

            normalize();

            this.getMatrix = function() {
                return matrix;
            }

            this.setRealWidth = function(val) {
                canvasWidth = val;
                normalize();
            }

            this.setRealHeight = function(val) {
                canvasHeight = val;
                normalize();
            }

            this.setMinX = function(val) {
                minx = val;
                normalize();
            }

            this.getMinX = function() {
                return minx;
            }

            this.setMaxX = function(val) {
                maxx = val;
                normalize();
            }
            this.getMaxX = function() {
                return maxx;
            }

            this.setMinY = function(val) {
                miny = val;
                normalize();
            }
            this.getMinY = function() {
                return miny;
            }

            this.setMaxY = function(val) {
                maxy = val;
                normalize();
            }
            this.getMaxY = function() {
                return maxy;
            }

            this.autoSetFromWidth = function(width) {
                maxx = width/2;
                minx = - maxx;

                var h = (width / canvasWidth) * canvasHeight;
                maxy = h/2;
                miny = - maxy;

                normalize();
            }

            this.autoSetFromHeight = function(height) {
                var h = (height / canvasHeight) * canvasWidth;

                maxx = h/2;
                minx = - maxx;

                maxy = height/2;
                miny = - maxy;

                normalize();
            }

        };

        var nm; // Our normalizer
        var bgLayer;
        var backgroundGroup;
        var plotLayer;
        var plotGroup;

        // We save the original points in memory for display, redraw:
        var plotPoints = [];

        var autoResize = function() {
            console.info('Resize smith chart');
            var chartheight;
            if (smithplot_settings.vertical_stretch) {
                chartheight = window.innerHeight - view.$el.offset().top - 20;
                if (settings.get("showstream"))
                    chartheight -= ($('#showstream').height() + 20);
            } else {
                chartheight = view.$el.parentElement.height();
            }
            view.$('.chart').css('height', chartheight + 'px');
            view.$('#smithchart').css('height', chartheight + 'px');
            view.$('#smithchart').css('width', '100%');
            // Manually resize the chart - we reset it completely
            paper.setup(view.$("#smithchart").get(0));
            nm = new coordNormalizer(view.$("#smithchart").width(), view.$("#smithchart").height());
            nm.autoSetFromHeight(2.2);
            if (bgLayer)
                drawGrid(bgLayer);
            if (plotLayer)
                redraw();
        }

        var addPlot = function () {
            if (smithplot_settings.vertical_stretch ||
                    smithplot_settings.vertical_stretch_parent) {
                view.rsc = autoResize;
                $(window).on('resize', view.rsc);
                autoResize();
            }
            paper.setup(view.$("#smithchart").get(0));
            nm = new coordNormalizer(view.$("#smithchart").width(), view.$("#smithchart").height());
            nm.autoSetFromHeight(2.2);
            bgLayer = new paper.Layer();
            backgroundGroup = new paper.Group();
            drawGrid(bgLayer); // Redraw the background

            // Setup the layer for plotting the graphs:
            plotLayer = new paper.Layer();
            plotGroup = new paper.Group();
            initPlot();
        };

        // Initialize the plot - empty the points we drew earlier,
        // set the clip circle.
        var initPlot = function() {
            plotLayer.activate();
            plotLayer.removeChildren(0);

            plotGroup.removeChildren(0);

            var clip = new paper.Path.Circle(new paper.Point(0, 0), 1.005);
            plotGroup.addChild(clip);

            plotGroup.clipped = true;
            plotLayer.addChild(plotGroup);
            plotLayer.setMatrix(nm.getMatrix());

            paper.project.view.draw();
        }

        // Add a point on the chart
        var drawPoint = function(point) {
            plotPoints.push(point); // Save the point
            var p = new paper.Path.Circle(new paper.Point(point.r, point.i), 0.008);
            p.opacity = 1;
            p.fillColor = 'red';
            p.setMatrix(nm.getMatrix());
            plotGroup.addChild(p);
            paper.project.view.draw();
        }

        // Redraw all the points
        // (used after a resize)
        var redraw = function() {
            initPlot();
            for (var i in plotPoints) {
                var p = new paper.Path.Circle(new paper.Point(plotPoints[i].r, plotPoints[i].i), 0.008);
                p.opacity = 1;
                p.fillColor = 'red';
                p.setMatrix(nm.getMatrix());
                plotGroup.addChild(p);
            }
            paper.project.view.draw();
        }

        function isWhole(num) {
            var i = Math.abs(num) % 1
            return ((i < 0.0000001) || (i > 0.9999999))
        }

        var circle_constRL = function (rl) {
            var center = new paper.Point(rl / (1.0 + rl), 0);
            var radius = 1.0 / (1.0 + rl);
            return paper.Path.Circle(center, radius);
        }

        var circle_constXL = function (xl) {
            var center = new paper.Point(1.0, 1.0 / xl);
            var radius = 1.0 / xl;
            return paper.Path.Circle(center, radius);
        }

        var drawGrid = function(layer) {
            layer.activate();
            layer.removeChildren(0);

            var xaxis = new paper.Path.Line(new paper.Point(nm.getMinX(),0), new paper.Point(nm.getMaxX(),0));
            xaxis.strokeColor = 'black';
            xaxis.strokeWidth = 2.5;
            xaxis.opacity = 0.6;

            backgroundGroup.removeChildren(0);

            // Clip to the unit circle (slightly outside)
            var clip = new paper.Path.Circle(new paper.Point(0, 0), 1.005);
            backgroundGroup.addChild(clip);
            backgroundGroup.addChild(xaxis);

            var i = 0;
            for (i = 0; i < 1005; i += 20) {
                var c = circle_constRL(i/100);
                c.strokeColor = "black";
                c.opacity = isWhole(i/100) ? 0.6 : 0.2;
                backgroundGroup.addChild(c);
                if (i<=100 || i%100==0) {
                    var pt = new paper.Point(1-2/(1+i/100)-0.015,0.025);
                    var t = new paper.PointText(pt);
                    t.fillColor='black';
                    t.fontSize = 1;
                    t.leading = 0;
                    t.content = '' + i/100;
                    t.justification = 'center';
                    t.rotate(-90);
                    t.scale(0.02, -0.02);
                    backgroundGroup.addChild(t);
                }
            }

            for (i = -500; i < 505; i += 20) {
                var c = circle_constXL(i/100);
                c.strokeColor = "black";
                c.opacity = isWhole(i/100) ? 0.6 : 0.2;
                if (Math.abs(i)<=100 || i%100==0) {
                    var r=100/i;
                    // Intersection of the two circles:
                    var y = 2*r/(r*r+1);
                    var x = (1-r*r)/(1+r*r)- 0.015;
                    // Move the text so that it shows up in the circle:
                    if (r < 1) {
                        y -= y/Math.abs(y) * 0.01;
                    } else {
                        y -= y/Math.abs(y) * 0.03;
                    }
                    var pt = new paper.Point(x,y);
                    var t = new paper.PointText(pt);
                    t.fillColor='black';
                    t.fontSize = 1;
                    t.leading = 0;
                    t.content = '' + i/100;
                    t.justification = 'center';
                    t.rotate(-Math.atan(y/x)*180/Math.PI);
                    t.scale(0.02, -0.02);
                    backgroundGroup.addChild(t);
                }
                backgroundGroup.addChild(c);
            }


            backgroundGroup.clipped = true;
            layer.addChild(backgroundGroup);

            layer.setMatrix(nm.getMatrix());
            paper.project.view.draw();

        }

        var setZ0 = function(r,x) {
            r0 = r;
            x0 = x;
        }

        // Calculate the reflection coefficient from the real measured
        // impedance (R / X, resistance/reactance)
        var gamma = function(r,x) {
            var mag = Math.pow(r+r0, 2) + Math.pow(x+x0, 2);
            var gr = (r*r + x*x - r0*r0 + x0*x0)/mag;
            var gi = 2 * (r*x0 + r0*x)/mag;

            return { r:gr, i: gi};
        }

        return Backbone.View.extend({

            initialize: function (options) {

                // Beware: we define "this.rsc" here because if we define it as a "var" on top, the requireJS caching
                // mechanism will turn it into one single reference for every flotplot instance, which is not what we want!
                // Make sure the chart takes all the window height:
                this.rsc = null;
                view = this;

                // Here are all the options we can define, to pass as "settings" when creating the view:

                // livedata is an array of all readings.
                // We can have multiple values plotted on the chart, so this is
                // an array of arrays.
                this.livedata = [];
                this.sensors = [];
                this.sensor_options = [];
                this.plotData = [];
                this.previousPoint = null;

                // Replace defaults by our own config for all keys
                // passed - if any
                if (options && options.settings) {
                    for (var prop in options.settings) {
                        if (prop != 'plot_options')
                            smithplot_settings[prop] = options.settings[prop];
                    }
                    // Also copy the plot options (don't just upate the reference, otherwise
                    // this causes random issues when using the same options objects for initializing
                    // several plots
                    if ('plot_options' in options.settings) {
                        for (var prop in options.settings.plot_options) {
                            smithplot_settings.plot_options[prop] = options.settings.plot_options[prop];
                        }
                    }
                }
            },

            // We have to call onClose when removing this view, because otherwise
            // the window resize callback lives on as a zombie and tries to resize
            // any chart anywhere...
            onClose: function () {
                 $(window).off('resize', this.rsc);
            },

            autoResize: function() {
                autoResize();
            },

            render: function () {
                console.log("Rendering a simple chart widget");
                this.$el.html('<div class="chart" style="position: relative; width:100%; height: 100px;"><canvas id="smithchart" style="width:100%; height:100%"></canvas></div>');
                addPlot();
                return this;
            },

            // Clears all graph data
            clearData: function () {
                this.livedata = [];
                this.sensors = [];
            },

            trimLiveData: function (idx) {
            },

            /**
             * Remove any data that is older than our max graph duration, for all
             * graphed values
             */
            trimOldData: function(ts) {
            },

            /**
             * Append a data point. Data should be in the form of
             * { name: "measurement_name", value: value } or
             * { name: "measurement_name", value: value, timestamp: timestamp } or
             * { name" "measurement_name", value: value, index: index }
             * You can also add an "options" key to pass additional config for plotting:
             * { name: "sensor_name", value: value, timestamp: timestamp, options: {lines: {show: true,fill: true},fillBetween: "vmin"}}
             *  Note: you can only set the options once.
             */
            fastAppendPoint: function (data) {
                // data  {r, i}
                var g = gamma(data.R, data.X);
                drawPoint(g, true);
                return this; // This lets us chain multiple operations
            },

            redraw: function () {
            },

            // This method forces a redraw and is slow: use fastAppendPoint for
            // loading a large number of points before redrawing
            appendPoint: function (data) {
                this.fastAppendPoint(data);
                // Save lots of battery by skipping the redraw when the plot is running
                // in a Cordova app and the app is not in front (screen off, etc)
                if (vizapp.state == 'paused')
                    return;
                this.redraw();
                return this; // This lets us chain multiple operations
            }
        });
        })();
});