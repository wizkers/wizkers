/**
 * Displays an editable view of instrument details.
 * We support instrument-specific metadata and ad-hoc view if the instrument
 * plugin defines it.
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */

define(function(require) {
    
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        utils   = require('app/utils'),
        template = require('js/tpl/InstrumentDetailsView.js');
    
    require('bootstrap');


    return Backbone.View.extend({
        
        id: "instrument-details",

        render: function () {
            console.log("Render instrument details");
            linkManager.once('ports', function(portlist) {
                $(this.el).html(template(_.extend(this.model.toJSON(), {instypes: instrumentManager.supportedInstruments, ports: portlist})));

                // If the instrument type has got its own extra settings, then render those here:
                var insSettingsView = instrumentManager.supportedInstruments[this.model.get('type')].settings;
                if ( insSettingsView != null) {
                    var settingsView = new insSettingsView({model: this.model});
                    $('#metadata',this.el).html(settingsView.el);
                    settingsView.render();
                }
            }, this);
            linkManager.getPorts();
            return this;
        },

        events: {
            "change"        : "change",
            "change #otherports" : "selectPort",
            "click .save"   : "beforeSave",
            "click .delete" : "deleteInstrument",
            "click #do-delete": "doDeleteInstrument",
            "dragover #icon"     : "dragOver",
            "dragleave #icon"     : "dragLeave",
            "drop #icon" : "dropHandler"
        },

        selectPort: function(event) {
            $('#port').val($('select#otherports').val());
            this.model.set({port: event.target.value});
        },

        change: function (event) {
            console.log("Instrument settings change");
            // Remove any existing alert message
            utils.hideAlert();

            // Apply the change to the model
            var target = event.target;
            var change = {};

            // Our Spinedit control returns values as strings even
            // when they are numbers (uses .val() in the setvalue method),
            // so we have to attempt to convert it back to a number if it makes
            // sense:
            var numval = parseFloat(target.value);
            change[target.name] = isNaN(numval) ? target.value : numval;
            this.model.set(change);

            // Run validation rule (if any) on changed item
            var check = this.model.validateItem(target.id);
            if (check.isValid === false) {
                utils.addValidationError(target.id, check.message);
            } else {
                utils.removeValidationError(target.id);
            }

            // TODO: is this right ?
            // This view is embedded into another view, so change events
            // are going to bubble up to the upper view and change attributes
            // with the same name, so we stop event propagation here:
            event.stopPropagation();
        },

        beforeSave: function () {
            var self = this;
            console.log('Instrument: before save for instrument ' + this.model.id);
            var check = this.model.validateAll();
            if (check.isValid === false) {
                utils.displayValidationErrors(check.messages);
                return false;
            }

            // Upload picture file if a new file was dropped in the drop area
            if (this.pictureFile) {
                utils.uploadFile("instruments/" + this.model.id + '/picture', this.pictureFile,
                    function () {
                        // The server will rename the file to the ID of the instrument,
                        // so let's set the picture accordingly and keep the
                        // filename extension:
                        self.model.set("icon", self.model.id + '.' + self.pictureFile.name.split(".").pop());
                        self.saveInstrument();
                    }
                );
            } else {
                this.saveInstrument();
            }
            return false;
        },

        saveInstrument: function () {
            var self = this;

            this.model.save(null, {
                success: function (model) {
                    utils.showAlert('Success', 'Configuration saved', 'alert-success');
                    // Trick: if we notice no instrument is selected, then select this one.
                    var ins = instrumentManager.getInstrument();
                    if (ins == null) {
                        settings.set({currentInstrument:model.id});
                        settings.save(); // will trigger an instrument change from the router
                    } else if (ins.id == model.id) {
                        // Force an instrument reload if we changed the settings
                        router.switchinstrument(model.id);
                    }
                },
                error: function () {
                    console.log('Instrument: error saving');
                    utils.showAlert('Error', 'An error occurred while trying to save intrument config', 'alert-danger');
                }
            });
        },
        
        deleteInstrument: function(event) {
            var self = this;
            if (this.model.id == undefined) {
                // Will happen if we are on a new instrument that was not saved yet
                // but where the user pressed delete
                console.log("User wants to delete an instrument that was not created yet");
                router.navigate('instruments', {trigger: true});
                return;
            }

            // We refuse to delete an instrument that contains logs
            var logs = this.model.logs;
            
            logs.fetch({
                success:function(res) {
                    if (res.length == 0) {
                        $('#deleteConfirm',self.el).modal('show');
                    } else {
                      utils.showAlert('Error', 'This instrument has logs associated to it. Delete them before deleting the instrument.'
                                      , 'alert-danger');  
                    }
                }});

        },

        doDeleteInstrument: function () {
            self = this;
            console.log("Delete instrument " + this.model.id);
            this.model.destroy({
                success: function () {
                    $('#deleteConfirm',self.el).modal('hide');
                    router.navigate('instruments', {trigger: true});
                }
            });
            return false;
        },


        dragOver: function(event) {
            //console.log('Something gettting dragged in here');
            $("#icon").addClass("hover");
            return false;
        },

        dragLeave: function(event) {
            $("#icon").removeClass("hover");
            return false;
        },

        dropHandler: function (event) {
            event.stopPropagation();
            event.preventDefault();
            var e = event.originalEvent;
            e.dataTransfer.dropEffect = 'copy';
            this.pictureFile = e.dataTransfer.files[0];

            // Read the image file from the local file system and display it in the img tag
            var reader = new FileReader();
            reader.onloadend = function () {
                $('#icon').attr('src', reader.result);
            };
            reader.readAsDataURL(this.pictureFile);
        }


    });
});