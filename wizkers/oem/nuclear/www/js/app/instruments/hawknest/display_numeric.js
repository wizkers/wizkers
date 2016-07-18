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

define(function(require) {
    "use strict";

    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        utils    = require('app/utils'),
        template = require('js/tpl/instruments/hawknest/HawkNestNumView.js');


    var probeid = '-';
    var readings = {};

    return Backbone.View.extend({

        initialize:function (options) {
            this.sessionStartStamp = new Date().getTime();
            this.maxreading = 0;
            this.minreading = -1;
            this.valid = false;
            this.validinit = false;

            linkManager.on('input', this.showInput, this);
        },

        events: {
        },

        render:function () {
            var self = this;
            this.$el.html(template());
            if (probeid != '-') {
                var pname = instrumentManager.getInstrument().get('metadata').probes[probeid].name || probeid;
                $("#probeid",this.el).html(pname);
                if (readings[probeid] != undefined) {
                    $('#livecpm', this.el).html(readings[probeid].cpm);
                    $('#livecpm2', this.el).html(readings[probeid].cpm2);
                    $('#liveusvh', this.el).html((parseFloat(readings[probeid].cpm2)/100).toFixed(3));
                }
            }
            return this;
        },

        onClose: function() {
            console.log("Hawk Nest numeric view closing...");
            linkManager.off('input', this.showInput, this);
        },

        selectProbe: function(pid) {
            probeid = pid;
            this.render();
        },

        showInput: function(data) {

            if (typeof(data.cpm) == 'undefined')
                return;

            var cpm = parseFloat(data.cpm.value).toFixed(0);
            var cpm2 = parseFloat(data.cpm2.value).toFixed(0);
            readings[data.probeid] = { cpm: cpm, cpm2: cpm2};

            if (data.probeid != probeid)
                return;

            $('#livecpm', this.el).html(cpm);
            $('#livecpm2', this.el).html(cpm2);
            $('#liveusvh', this.el).html((parseFloat(data.cpm2.value)/100).toFixed(3));

        },


    });
});