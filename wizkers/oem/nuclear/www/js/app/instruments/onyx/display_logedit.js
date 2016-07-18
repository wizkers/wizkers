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
 * Edit the content of a log/ Only lets the user delete a point
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function(require) {
    "use strict";

    var $        = require('jquery'),
        _        = require('underscore'),
        Backbone = require('backbone'),
        bootbox  = require('bootbox'),
        template = require('js/tpl/instruments/onyx/OnyxLogEditView.js');

    return Backbone.View.extend({

        initialize:function () {

            this.deviceLogs = this.collection;

            // Need this to make sure "render" will always be bound to our context.
            // -> required for the _.after below.
            _.bindAll(this,"render");

            // Now fetch all the contents, then render
            var renderTable = _.after(this.deviceLogs.length, this.render);
            this.deviceLogs.each(function(log) {
                log.entries.fetch({success: renderTable,
                                   });
            });

            this.collection.on("remove", this.render, this);
        },

        render:function () {
            console.log("Log Edit Render");

            var logEntries = [];
            this.deviceLogs.each(function(log) {
                logEntries = logEntries.concat(log.entries.models);
            });


            this.$el.html(template({entries: logEntries}));

            $('#log_size',this.el).html(this.deviceLogs.getOverallLength());
            $('#log_start',this.el).html(new Date(this.deviceLogs.getLogsStart()).toString());
            $('#log_end',this.el).html(new Date(this.deviceLogs.getLogsEnd()).toString());

            // Now, we only want to scroll the table, not the whole page:
            var tbheight = window.innerHeight - $('.header .container').height() - 20;
            $('#tablewrapper',this.el).css('max-height',
                                       tbheight + 'px'
                                            );

            return this;
        },

        handleProgress: function(e) {
                $('#loadtext').html("Loaded: " + e.loaded + " bytes");
        },


        onClose: function() {
            this.collection.off("remove", this.render, this);
        },

        events: {
            "click .delete-point" : "deletePoint",
        },

        deletePoint: function(event) {
            var self = this;
            var datapointId = $(event.target).data("id");
            bootbox.confirm("Delete this data point, are you sure?",  function(result) {
                             if (result) {
                                 // collection is a collection of logs
                                 var datapoint = self.collection.getEntry(datapointId);
                                 datapoint.destroy({
                                    success: function () {
                                        self.render();
                                    }});
                                    }
                                });
        },
    });
});