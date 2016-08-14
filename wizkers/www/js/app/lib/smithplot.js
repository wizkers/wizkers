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
        var staticGroup;

        var addPlot = function () {
                paper.setup(view.$("#smithchart").get(0));
                nm = new coordNormalizer(view.$("#smithchart").width(), view.$("#smithchart").height());
                nm.autoSetFromHeight(2.2);
                bgLayer = new paper.Layer();
                staticGroup = new paper.Group();
                drawGrid(bgLayer);
        };

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

            var xaxis = new paper.Path.Line(new paper.Point(0, nm.getMinY()), new paper.Point(0, nm.getMaxY()));
            xaxis.strokeColor = 'black';
            xaxis.strokeWidth = 2.5;
            xaxis.opacity = 0.6;
            var yaxis = new paper.Path.Line(new paper.Point(nm.getMinX(), 0), new paper.Point(nm.getMaxX(), 0));
            yaxis.strokeColor = 'black';
            yaxis.strokeWidth = 2.5;
            yaxis.opacity = 0.6;

            staticGroup.removeChildren(0);

            // Clip to the unit circle (slightly outside)
            var clip = new paper.Path.Circle(new paper.Point(0, 0), 1.005);
            staticGroup.addChild(clip);

            var i = 0;
            for (i = 0; i < 10.05; i += 0.2) {
                var c = circle_constRL(i);
                c.strokeColor = "black";
                c.opacity = isWhole(i) ? 0.6 : 0.2;
                staticGroup.addChild(c);
            }

            for (i = -5; i < 5.05; i += 0.2) {
                var c = circle_constXL(i);
                c.strokeColor = "black";
                c.opacity = isWhole(i) ? 0.6 : 0.2;
                staticGroup.addChild(c);
            }

            staticGroup.clipped = true;
            layer.addChild(staticGroup);

            layer.setMatrix(nm.getMatrix());
            paper.project.view.draw();

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

                // this.plotOptions = this.flotplot_settings.plot_options;

            },

            // We have to call onClose when removing this view, because otherwise
            // the window resize callback lives on as a zombie and tries to resize
            // any chart anywhere...
            onClose: function () {
            },

            render: function () {
                console.log("Rendering a simple chart widget");
                this.$el.html('<div class="chart" style="position: relative; width:100%; height: 100px;"><canvas id="smithchart" style="width:100%"></canvas></div>');
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