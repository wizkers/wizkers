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
 * Our model is the settings object.
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function(require) {
    "use strict";

    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        template = require('js/tpl/instruments/kestrel5/NumView.js');

    return Backbone.View.extend({

        initialize:function (options) {
            linkManager.on('input', this.showInput, this);
            this.sensors = {};

            // Start a watchdog every minute to go over the sensors and find out
            // which ones are stale/lost:
            _.bindAll(this,"refreshSensors");
            this.watchdog = setInterval(this.refreshSensors, 60000);

        },

        render:function () {
            var self = this;
            console.log('Main render of Kestrel5 numeric view');
            this.$el.html(template());
            return this;
        },

        onClose: function() {
            console.log("Kestrel5 numeric view closing...");
            linkManager.off('input', this.showInput, this);
            clearInterval(this.watchdog);

        },

        showInput: function(data) {
            var stamp = new Date().getTime();
            // Get sensor info: if we know it, update the value & label
            // if we don't, add it
            var sensor = data.sensor_name + " - " + data.reading_type;
            var sensordata = this.sensors[sensor];
            if (sensordata == undefined) {
                $('#sensorlist',this.el).append('<li id="' + sensor.replace(/ /g, '_') + '">' +
                                                '<span class="label label-success">&nbsp;</span>&nbsp;' +
                                                sensor + ':&nbsp;' +
                                                ((data.reading_type == 'wind' ||
                                                  data.reading_type == 'wind-gust') ? data.value.dir + '° - ' + data.value.speed + 'knt' : data.value) + '</li>');
            } else {
                $('#' + sensor.replace(/ /g, '_'), this.el).html('<span class="label label-success">&nbsp;</span>&nbsp;' +
                                                sensor + ':&nbsp;' + ((data.reading_type == 'wind' ||
                                                  data.reading_type == 'wind-gust') ? data.value.dir + '° - ' + data.value.speed + 'knt' : data.value) + '</li>');
            }
            this.sensors[sensor] = { stamp: stamp};


        },

        refreshSensors: function() {
            var self = this;
            console.log("Refresh Sensor labels in num view");
            var stamp = Date.now();
            _.each(this.sensors,function(value,key) {
                if (stamp - value.stamp > 300000) { // 5 minutes, lost
                    $('#' + key.replace(/ /g, '_'), self.el).find('.label').removeClass('label-warning').addClass('label-danger');

                } else if (stamp - value.stamp > 180000) { // 3 minutes, stale
                    $('#' + key.replace(/ /g, '_'), self.el).find('.label').removeClass('label-success').addClass('label-warning');
                }
            });
        }

    });
});