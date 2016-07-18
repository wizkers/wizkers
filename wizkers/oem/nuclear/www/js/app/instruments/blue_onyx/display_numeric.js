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
 * Display output of Geiger counter in numeric format
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        utils = require('app/utils'),
        template = require('js/tpl/instruments/blueonyx/NumView.js');


    return Backbone.View.extend({

        initialize: function (options) {
            this.sessionStartStamp = new Date().getTime();
            this.maxreading = 0;
            this.minreading = -1;
            this.valid = false;
            this.validinit = false;
            linkManager.on('input', this.showInput, this);
        },

        events: {},

        render: function () {
            var self = this;
            console.log('Main render of Blue Onyx numeric view');
            this.$el.html(template());
            // We need to force the Live view to resize the map at this
            // stage, becaure we just changed the size of the numview
            if (instrumentManager.liveViewRef() && instrumentManager.liveViewRef().rsc) {
                instrumentManager.liveViewRef().rsc();
            };

            // Cache the query for energy efficiency/memory efficiency
            this.batt_icon = $('#batteryempty', this.el);
            this.lat_span = $('#lat', this.el);
            this.lon_span = $('#lon', this.el);
            this.valid_label = $('#readingvalid', this.el);
            this.cpm_span = $('#livecpm', this.el);
            this.usv_span = $('#liveusvh', this.el);
            return this;
        },

        onClose: function () {
            console.log("Blue Onyx numeric view closing...");
            linkManager.off('input', this.showInput, this);
        },

        showInput: function (data) {

            if (data.reconnecting != 'undefined') {
                $('#numview_in', this.el).css('color', data.reconnecting ? '#a1a1a1' : '#000000');
            }

            if (typeof (data.cpm) == 'undefined')
                return;

            var self = this;
            var cpm = parseFloat(data.cpm.value);
            var usv = parseFloat(data.cpm.usv);
            var count = parseInt(data.cpm.count);
            this.cpm_span.html(cpm.toFixed(0));
            if (usv) {
                this.usv_span.html(usv.toFixed(3) + "&nbsp;&mu;Sv/h");
            }

            if (!data.batt_ok) {
                this.batt_icon.show();
            } else {
                this.batt_icon.hide();
            }

            if (data.loc_status && data.loc_status == 'OK') {
                var coord = utils.coordToString({
                    lat: data.loc.coords.latitude,
                    lng: data.loc.coords.longitude
                });
                this.lat_span.html(coord.lat);
                this.lon_span.html(coord.lng);
            } else if (data.loc_status) {
                this.lat_span.html('GPS: ' + data.loc_status);
                this.lon_span.html('');
            }

            // Create a blinking effect to indicate that we received data:
            this.valid_label.addClass('label-info').removeClass('label-danger').removeClass('label-success');
            setTimeout(function () {
                self.valid_label.removeClass('label-info');
                if (data.cpm.valid)
                    self.valid_label.removeClass('label-danger').addClass('label-success').html('OK');
                else
                    self.valid_label.removeClass('label-success').addClass('label-danger').html('V');
            }, 250);

        },


    });
});