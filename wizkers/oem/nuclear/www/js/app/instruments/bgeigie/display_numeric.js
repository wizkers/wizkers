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
        template = require('js/tpl/instruments/bgeigie/NumView.js');


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
            console.log('Main render of bGeigie numeric view');
            this.$el.html(template());
            // We need to force the Live view to resize the map at this
            // stage, becaure we just changed the size of the numview
            if (instrumentManager.liveViewRef() && instrumentManager.liveViewRef().rsc) {
                instrumentManager.liveViewRef().rsc();
            };
            return this;
        },

        onClose: function () {
            console.log("bGeigie numeric view closing...");
            linkManager.off('input', this.showInput, this);
        },

        showInput: function (data) {

            if (data.replay_ts != undefined)
                return;

            if (data.reconnecting != undefined ) {
                $('#numview_in', this.el).css('color', data.reconnecting ? '#a1a1a1' : '#000000');
            }

            if (data.error != undefined) {
                // Provide visual feedback if we are receiving invalid data
                // from the bGeigie - mostly a debug & diagnostic help
                $('#readingvalid', this.el).addClass('label-info').removeClass('label-danger').removeClass('label-success');
                setTimeout(function () {
                    $('#readingvalid', this.el).removeClass('label-info');
                    $('#readingvalid', this.el).removeClass('label-success').addClass('label-danger').html(data.error);
                }, 250);
                return;
            }

            if (typeof (data.cpm) == 'undefined')
                return;
            var cpm = parseFloat(data.cpm.value);
            var usv = parseFloat(data.cpm.usv);
            var count = parseInt(data.cpm.count);
            $('#livecpm', this.el).html(cpm.toFixed(0));
            if (usv) {
                $('#liveusvh', this.el).html(usv.toFixed(3) + "&nbsp;&mu;Sv/h");
            }
            if (count) {
                $('#count', this.el).html(count);
            }

            if (data.loc_status && data.loc_status == 'OK') {
                var coord = utils.coordToString({
                    lat: data.loc.coords.latitude,
                    lng: data.loc.coords.longitude
                });
                $('#lat', this.el).html(coord.lat);
                $('#lon', this.el).html(coord.lng);
                $('#sats', this.el).html(data.loc.sats);
            } else if (data.loc_status) {
                $('#lat', this.el).html('GPS: ' + data.loc_status);
                $('#lon', this.el).html('');
            }

            // Create a blinking effect to indicate that we received data:
            $('#readingvalid', this.el).addClass('label-info').removeClass('label-danger').removeClass('label-success');
            setTimeout(function () {
                $('#readingvalid', this.el).removeClass('label-info');
                if (data.cpm.valid)
                    $('#readingvalid', this.el).removeClass('label-danger').addClass('label-success').html('OK');
                else
                    $('#readingvalid', this.el).removeClass('label-success').addClass('label-danger').html('V');
            }, 250);

        },


    });
});