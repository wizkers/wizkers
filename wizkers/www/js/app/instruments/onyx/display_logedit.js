/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
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
        template = require('js/tpl/instruments/OnyxLogEditView.js');

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