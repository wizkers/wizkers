window.InstrumentDetailsView = Backbone.View.extend({

    initialize: function () {        
        
    },

    render: function () {
        var self = this;
        console.log("Render instrument details");
        linkManager.getPorts();
        linkManager.once('ports', function(portlist) {
            $(self.el).html(self.template(_.extend(self.model.toJSON(), {instypes: instrumentManager.supportedInstruments, ports: portlist})));
            
            // If the instrument type has got its own extra settings, then render it here:
            var insSettingsView = instrumentManager.supportedInstruments[self.model.get('type')].settings;
            if ( insSettingsView != null) {
                var settingsView = new insSettingsView({model: self.model});
                $('#metadata',self.el).html(settingsView.el);
                settingsView.render();
            }
        });
        

        return this;
    },

    
    events: {
        "change"        : "change",
        "change #otherports" : "selectPort",
        "click .save"   : "beforeSave",
        "click .delete" : "deleteInstrument",
        "dragover #icon"     : "dragOver",
        "dragleave #icon"     : "dragLeave",
        "drop #icon" : "dropHandler"
    },
    
    selectPort: function(event) {
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
            },
            error: function () {
                console.log('Instrument: error saving');
                utils.showAlert('Error', 'An error occurred while trying to save intrument config', 'alert-error');
            }
        });
    },

    deleteInstrument: function () {
        self = this;
        console.log("Delete instrument " + this.model.id);
        this.model.destroy({
            success: function () {
                //alert('Controller deleted successfully');
                self.remove();
                //this.render();
                return false;
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