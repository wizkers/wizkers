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
 *
 * Send data to another system through a TCP/IP socket (UDP support TODO)
 *
 * This file manages the settings view for settings that are
 * specific to this output, and that are stored in the output's
 * metadata
 *
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */


define(function(require) {

    "use strict";

    var _ = require('underscore'),
        Backbone = require('backbone');

    var  template = require('tpl/outputs/NetlinkSettingsView');

    return Backbone.View.extend({
            initialize:function () {
                // Metadata is a simple object looking like this:
                // {  'address': 'name', 'address2': 'name2', etc... }
                this.metadata = this.model.get('metadata');
                if (Object.keys(this.metadata).length == 0) {
                    this.metadata = {ipaddress: "127.0.0.1", port: "1432"};
                    this.model.set('metadata', this.metadata);
                }
            },

            render:function () {
                this.$el.html(template({metadata: this.metadata}));
                return this;
            },

            events: {
                "change" : "change"
            },

            change: function(event) {
                console.log("Netlink output bespoke settings change");

                // Apply the change to the metadata
                var target = event.target;
                this.metadata[target.name] = target.value;
                this.model.set('metadata',this.metadata);

                // This view is embedded into another view, so change events
                // are going to bubble up to the upper view and change attributes
                // with the same name, so we stop event propagation here:
                if (target.name != "numfields")
                    event.stopPropagation();

            },
    });
});
