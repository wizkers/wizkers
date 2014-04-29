/**
 * Edit the content of a log/ Only lets the user delete a point
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 */

define(function(require) {
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        tpl     = require('text!tpl/instruments/OnyxLogEditView.html'),
        template = null;
        
        try {
            template = _.template(tpl);
        } catch (e) {
            // Will happen if we are packaged in a Chrome app
            template = require('js/tpl/instruments/OnyxLogEditView.js', function(){} , function(err) {
                            console.log("Compiled JS preloading error callback.");
                            });
        }

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


            $(this.el).html(template({entries: logEntries}));

            $('#log_size',this.el).html(this.deviceLogs.getOverallLength());
            $('#log_start',this.el).html(new Date(this.deviceLogs.getLogsStart()).toString());
            $('#log_end',this.el).html(new Date(this.deviceLogs.getLogsEnd()).toString());

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