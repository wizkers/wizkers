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

/**
 *  Settings returns an intrument settings view. These are displayed
 * on top of standard instrument settings in the instrument details view.
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */


define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        template = require('js/tpl/instruments/SimpleSerialSettingsView.js');

    return Backbone.View.extend({
        initialize: function () {
            // Metadata is a simple object looking like this:
            // {  'baudrate': 115200 }
            this.portsettings = this.model.get('metadata');
            if (this.portsettings == null) {
                this.portsettings = {
                    baudrate: 115200,
                    lines: 600
                };
                this.model.set('metadata', this.portsettings);
            }
            this.render();
        },

        render: function () {
            this.$el.html(template({
                portsettings: this.portsettings
            }));
            return this;
        },

        events: {
            "change": "change"
        },

        change: function (event) {
            console.log("Simple Serial bespoke settings change");

            // Apply the change to the metadata
            var target = event.target;
            this.portsettings[target.name] = target.value;
            this.model.set('metadata', this.portsettings);

            // This view is embedded into another view, so change events
            // are going to bubble up to the upper view and change attributes
            // with the same name, so we stop event propagation here:
            event.stopPropagation();

        },
    });
});