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
 *  This implementation takes a lot from https://github.com/cemulate/smith-chart/
 *  and is used with permission, thank you!
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

        console.log("Creating Core Smith Chart object");

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
                dot_size: 0.006
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

            this.inverseTransform = function(point) {
                var inv = matrix.inverted()
                return inv.transform(point)
            }

        };

        var nm; // Our normalizer
        var bgLayer;
        var backgroundGroup;
        var plotLayer;
        var plotGroup;
        // Now the cursor and mouse event handlers
        var cursorLayer;
        var cursorGroup;
        var mouseTool;
        var cursor;

        // This layer is not clipped
        var infoLayer;
        var infoGroup;

        // Avoid auto-resizing the canvas before paper is ready
        var paperReady = false;

        // We save the original points in memory for display, redraw:
        var plotPoints = [];
        var swrCircle = 1;

        var autoResize = function() {
            console.info('Resize smith chart');
            if (!paperReady)
                return;
            var chartheight;
            if (smithplot_settings.vertical_stretch) {
                chartheight = window.innerHeight - view.$el.offset().top - 20;
                if (settings.get("showstream"))
                    chartheight -= ($('#showstream').height() + 20);
            } else {
                chartheight = view.$el.parentElement.height();
            }
            view.$('.chart').css('height', chartheight + 'px');
            // This is the best way to resize the paper canvas:
            paper.view.viewSize.width = view.$('.chart').width();
            paper.view.viewSize.height = chartheight;
            var w = view.$("#smithchart").width();
            var h = view.$("#smithchart").height();
            nm = new coordNormalizer(w, h);
            if (w >= h) {
                nm.autoSetFromHeight(2.2);
            } else {
                nm.autoSetFromWidth(2.2);
            }
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
            // Never call this one more than once:
            paper.setup(view.$("#smithchart").get(0));
            var w = view.$("#smithchart").width();
            var h = view.$("#smithchart").height();
            nm = new coordNormalizer(w, h);
            if (w >= h) {
                nm.autoSetFromHeight(2.2);
            } else {
                nm.autoSetFromWidth(2.2);
            }
            bgLayer = new paper.Layer();
            backgroundGroup = new paper.Group();
            drawGrid(bgLayer); // Redraw the background

            // Setup the mouse events
            mouseTool = new paper.Tool();
            cursorLayer = new paper.Layer();
            cursorGroup = new paper.Group();
            initMouse();

            // Setup the layer for plotting the graphs:
            plotLayer = new paper.Layer();
            plotGroup = new paper.Group();
            initPlot();

            infoLayer = new paper.Layer();
            infoGroup = new paper.Group();

            paperReady = true;

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

        /**
         * Initialize the mouse events for the graph
         */
        var initMouse = function() {
            mouseTool.onMouseMove = function(e) {
                var p = nm.inverseTransform(e.point);
                if (Math.sqrt(p.x*p.x + p.y*p.y) < 1) {
                    // Point is the gamma value, we need to
                    // calculate R / X from it:
                    drawCursorLayer(imp(p.x, p.y));
                } else {
                    cursorLayer.removeChildren(0);
                    cursorGroup.removeChildren(0);
                    paper.project.view.draw();
                }
                return false; // Block event bubbling so that
                              // on a mobile device, we won't start
                              // scrolling when dragging a finger on the
                              // chart
            }
        }

        /**
         * Add a point on the chart
         */
        var drawPoint = function(point) {
            plotPoints.push(point); // Save the point
            var p = new paper.Path.Circle(new paper.Point(point.r, point.i), smithplot_settings.plot_options.dot_size);
            p.opacity = 1;
            p.fillColor = 'red';
            p.setMatrix(nm.getMatrix());
            p.onMouseEnter = showInfo;
            p.onMouseLeave = hideInfo;
            p.data = point.data;
            plotGroup.addChild(p);
            paper.project.view.draw();
        }

        /**
         * Redraw all the points
         *  (used after a resize)
         */
        var redraw = function() {
            initPlot();
            for (var i in plotPoints) {
                var p = new paper.Path.Circle(new paper.Point(plotPoints[i].r, plotPoints[i].i),
                                                smithplot_settings.plot_options.dot_size);
                p.opacity = 1;
                p.fillColor = 'red';
                p.setMatrix(nm.getMatrix());
                p.onMouseEnter = showInfo;
                p.onMouseLeave = hideInfo;
                p.data = plotPoints[i].data;
                plotGroup.addChild(p);
            }
            paper.project.view.draw();
            plotLayer.activate();
        }

        /**
         * Popup an info bubble. Right now, assumes data.F is the
         * frequency in Hz.
         *
         */
        var showInfo = function(e) {
            console.info('Item detected:', e.target.data);
            infoLayer.activate();
            infoLayer.removeChildren(0);
            infoGroup.removeChildren(0);
            var st = (e.target.data.F / 1e6).toFixed(4) + ' MHz';
            var t = new paper.PointText(e.point);
            t.fillColor = '#ffffff';
            t.fontSize = 18;
            t.content = st;
            var rc = new paper.Path.Rectangle(t.getBounds().scale(1.1), 6 );
            rc.opacity = 0.7;
            rc.fillColor = 'black';
            infoGroup.addChild(rc);
            infoGroup.addChild(t)
            infoLayer.addChild(infoGroup);
        }

        var hideInfo = function(e) {

        }


        /**
         * Draw the cursor on the chart, as a constant XL/RL
         * circle intersection
         *
         * point  Object { r: resistance, x: reactance}
         */
        var drawCursorLayer = function(point) {
            cursorLayer.activate();
            cursorLayer.removeChildren(0);
            cursorGroup.removeChildren(0);

            var clip = new paper.Path.Circle(new paper.Point(0, 0), 1.005);
            cursorGroup.addChild(clip);

            var rl = circle_constRL(point.r);
            rl.opacity = 1;
            rl.strokeColor = 'blue';
            rl.strokeWidth = 1;
            cursorGroup.addChild(rl);

            var xl = circle_constXL(point.x);
            xl.opacity=1;
            xl.strokeColor = 'blue';
            xl.strokeWidth = 1;
            cursorGroup.addChild(xl);

            cursorGroup.clipped = true;
            cursorLayer.addChild(cursorGroup);
            cursorLayer.setMatrix(nm.getMatrix());
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

        /**
         * Draw the chart background. This includes both the circles, and
         * the numbers. Note that the numbers are very small, and only really
         * make sense on larger resolutions or screen sizes.
         */
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
                    t.fontSize = 10; // Don't pick less than this, it creates
                                     // issues on the Chrome runtime on Android
                    t.leading = 0;
                    t.content = '' + i/100;
                    t.justification = 'center';
                    t.rotate(-90);
                    t.scale(0.003, -0.003);
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
                    var x = (1-r*r)/(1+r*r);
                    // Move the text so that it shows up in the circle:
                    if (r < 1) {
                        y -= y/Math.abs(y) * 0.02;
                    } else {
                        y -= y/Math.abs(y) * 0.03;
                    }
                    var pt = new paper.Point(x,y);
                    var t = new paper.PointText(pt);
                    t.fillColor='black';
                    t.fontSize = 10;
                    t.leading = 0;
                    t.content = '' + i/100;
                    t.justification = 'center';
                    t.scale(0.003, -0.003);
                    var w = t.bounds.getWidth()/1.7;
                    t.rotate(90+Math.atan((y-r)/(x-1))*180/Math.PI);
                    t.setPoint((1-w)*x, (1-w)*y);
                    backgroundGroup.addChild(t);
                }
                backgroundGroup.addChild(c);
            }

            // Add the SWR circle
            var p = new paper.Path.Circle(new paper.Point(0,0), 1-2/(1+swrCircle));
            p.opacity = 1;
            p.strokeColor = 'green';
            p.dashArray = [5,8];
            backgroundGroup.addChild(p);

            backgroundGroup.clipped = true;
            layer.addChild(backgroundGroup);

            layer.setMatrix(nm.getMatrix());
            paper.project.view.draw();

        }

        var setZ0 = function(r,x) {
            r0 = r;
            x0 = x;
        }

        /**
         * Calculate the reflection coefficient from the real measured
         *  impedance (R / X, resistance/reactance)
         *  gamma = (z-z0)/(z+z0)
         */
        var gamma = function(r,x) {
            var mag = Math.pow(r+r0, 2) + Math.pow(x+x0, 2);
            var gr = (r*r + x*x - r0*r0 + x0*x0)/mag;
            var gi = 2 * (r*x0 + r0*x)/mag;

            return { r:gr, i: gi};
        }

        /**
         * Calculate resistance/reactance from Gamma
         * (normalized to 1)
         *  z = (1+gamma)/(1-gamma)
         */
        var imp = function(r,i) {
            var c = i*i+r*r-2*r+1;
            var a = (1 - r*r - i*i)/c;
            var b = 2*i/c;
            return { r: a,
                     x: b
                    };
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
                console.log('Closing Smith Chart');
                // We need to make sure we destroy all the projects
                // and tools we created on the chart, otherwise bad things
                // will happen next time we start a Smith Chart view
                while (paper.projects.length) {
                    paper.projects[0].remove();
                }
                while (paper.tools.length) {
                    paper.tools[0].remove();
                }

                 $(window).off('resize', this.rsc);
            },

            autoResize: function() {
                autoResize();
            },

            render: function () {
                console.log("Rendering a simple chart widget");
                this.$el.html('<div class="chart" style="position: relative; width:100%; height: 100px;"><canvas id="smithchart"></canvas></div>');
                addPlot();
                return this;
            },

            // Clears all graph data
            clearData: function () {
                plotPoints = [];
                initPlot();
            },

            setSWRCircle : function(swr) {
                swrCircle = parseFloat(swr);
                autoResize(); // Forces a redraw including the background
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
             * { R: resistance, X: reactance data: { arbitrary key/values} }
             */
            fastAppendPoint: function (data) {
                // data  {r, i}
                var g = gamma(data.R, data.X);
                if (data.data)
                    g.data = data.data;
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
        });
});