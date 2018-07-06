/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2018 Edouard Lafargue, ed@wizkers.io
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
 * Live view display of PCSC Card readers
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        template = require('js/tpl/instruments/bleloc/LiveView.js'),
        bvtemplate = require('js/tpl/instruments/bleloc/bvView.js');

    // Need to load these, but no related variables.
    require('bootstrap');


    var beaconView = Backbone.View.extend({
        tagName: "div",
        className: "col-xs-2",

        initialize: function() {
            console.log('Model', this.model);
        },
        render: function() {
            this.$el.html(bvtemplate(this.model));
            return this;
        }
    });




    return Backbone.View.extend({

        initialize: function (options) {

            this.update_count = 0;
            this.datasetlength = 0;

            this.stations = [];
            this.cards = [];


            if (vizapp.type == 'cordova') {
                var wz_settings = instrumentManager.getInstrument().get('wizkers_settings');
                if (wz_settings) {
                    if (wz_settings.screen_no_dim == 'true') {
                        keepscreenon.enable();
                    } else {
                        keepscreenon.disable();
                    }
                } else {
                    // Happens when the user never explicitely set the screen dim
                    keepscreenon.disable();
                }
            }

            linkManager.on('status', this.updatestatus, this);
            linkManager.on('input', this.showInput, this);

        },


        events: {
            'click .utility_close': 'closeUtil'
        },

        tab_shown: function (e) {
            if (this.rsc)
                this.rsc();
        },

        render: function () {
            var self = this;
            console.log('Main render of BLE Loc view');
            this.$el.html(template());

            linkManager.requestStatus();
            return this;
        },

        onClose: function () {
            console.log("BLE Loc live view closing...");
            linkManager.stopLiveStream();
            linkManager.off('status', this.updatestatus);
            linkManager.off('input', this.showInput);
        },

        appendToResponse: function(str) {
            var i = this.$('#cardresponse');
            i.val(i.val() + str );
            // Autoscroll:
            i.scrollTop(i[0].scrollHeight - i.height());
        },


        updatestatus: function (data) {
            console.log("BLE Loc live display: link status update");
        },

        clear: function () {
            console.log('Clear');
        },

        // We get there whenever we receive something from the serial port
        showInput: function (data) {
            var self = this;
            console.log('Data', data);
            if (data.address) {
                var mac = data.address.replace(/:/g,'')
                if (this.stations[mac]) {
                    data.mac = mac;
                    this.cards[mac].model = data;
                    this.cards[mac].render();
                    self.$('#' + mac + ' .rssi').addClass('bg-warning');
                    setTimeout(function() {self.$('#' + mac + ' .rssi').removeClass('bg-warning');}, 200 );
                } else {
                    this.stations[mac] = data;
                    data.mac = mac;
                    this.cards[mac] = new beaconView({ model: data});
                    this.$('#beaconlist').append(
                        this.cards[mac].render().el
                    );
                }
            }

        },
    });

});