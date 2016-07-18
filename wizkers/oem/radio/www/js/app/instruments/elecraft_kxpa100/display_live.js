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
 * Live view for the KXPA100 amplifier as standalone instrument
 *
 * Our model is the settings object.
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        utils = require('app/utils'),
        template = require('js/tpl/instruments/elecraft/KXPA100-standalone.js');

    return Backbone.View.extend({

        initialize: function (options) {
            this.deviceinitdone = false;
            linkManager.on('status', this.updateStatus, this);
        },

        render: function () {
            var self = this;
            console.log('Main render of KXPA100 Standalone main view');
            this.$el.html(template());

            require(['app/instruments/elecraft/display_kxpa100'], function(view) {
               self.KXPA100 = new view();
               $('#kxpa100', self.el).append(self.KXPA100.el);
               self.KXPA100.render();
            });

            return this;
        },

        onClose: function () {
            this.KXPA100.onClose();
            linkManager.off('status', this.updatestatus, this);
        },

        updateStatus: function (data) {
            if (data.portopen && !this.deviceinitdone) {
                this.KXPA100.shown(true);
                this.deviceinitdone = true;

                linkManager.driver.getRequestedPower();
            } else if (!data.portopen) {
                this.deviceinitdone = false;
                this.KXPA100.shown(false);
            }
        },


    });
});