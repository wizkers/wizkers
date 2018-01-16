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
 * Geiger Link provides slightly different outputs from the Onyx, so
 * we are using a different display for it:
 *
 * @author Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */

define(function(require) {
    "use strict";

    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        utils    = require('app/utils'),
        template = require('js/tpl/instruments/kestreldrop/NumView.js');


    return Backbone.View.extend({

        initialize:function (options) {
            this.sessionStartStamp = new Date().getTime();
            this.valid = false;
            this.validinit = false;

            linkManager.on('input', this.showInput, this);
        },

        events: {
        },

        render:function () {
            var self = this;
            console.log('Main render of Kestrel Drop view');
            this.$el.html(template());
            // We need to force the Live view to resize the map at this
            // stage, becaure we just changed the size of the numview
            if (instrumentManager.liveViewRef() && instrumentManager.liveViewRef().rsc) {
                instrumentManager.liveViewRef().rsc();
            };
            return this;
        },

        onClose: function() {
            console.log("Kestrel5 numeric view closing...");
            if (this.plot)
                this.plot.onClose();
            linkManager.off('input', this.showInput, this);
        },

        disp_wx: function(data,ts) {
            if (data.temperature != undefined) {
                this.$('#tempreading').html(utils.round(data.temperature,1) + '&nbsp;&deg;');
            }
            if (data.dew_point != undefined) {
                this.$('#dewpointreading').html(utils.round(data.dew_point,1) + '&nbsp;&deg;');
            }
            if (data.heat_index != undefined) {
                this.$('#heatindexreading').html(utils.round(data.heat_index,1) + '&nbsp;&deg;');
            }
            if (data.wetbulb != undefined) {
                this.$('#wetbulbreading').html(utils.round(data.wetbulb,1) + '&nbsp;&deg;');
            }  else {
                if (this.$('#wetbulbreading').is(':visible')) {
                    this.$('#wetbulbreading').parent().hide();
                    instrumentManager.liveViewRef().rsc();
                }
            }
            if (data.rel_humidity != undefined) {
                this.$('#rhreading').html(utils.round(data.rel_humidity,0) + '&nbsp;%');
            }
            if (data.pressure != undefined) {
                this.$('#pressurereading').html(utils.round(data.pressure,0) + '&nbsp;<small>mb</small>');
            }
            if (data.dens_altitude != undefined) {
                this.$('#densaltitudereading').html(utils.round(data.dens_altitude,0) + '&nbsp;<small>m</small>');
            }

        },

        clear: function () {
        },

        showInput: function(data) {

            if (data.replay_ts != undefined) {
                return;
            }

            // Grey out readings if we lost connectivity to the Kestrel 5 unit
            if (data.reconnecting != undefined ) {
                this.$('#numview_in').css('color', data.reconnecting ? '#a1a1a1' : '#000000');
            }

            this.disp_wx(data);

        },


    });
});