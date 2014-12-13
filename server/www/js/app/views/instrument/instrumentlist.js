/**
 * Defines a list of instruments, arranged as a series of 'cards'
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */

define(function(require) {
    
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        Paginator = require('app/views/paginator'),
        template = require('js/tpl/InstrumentListItemView.js');
    
        var InstrumentListItemView = Backbone.View.extend({

            tagName: "div",
            className: "col-md-3 col-sm-2",

            initialize: function (options) {
                this.model.bind("change", this.render, this);
                this.model.bind("destroy", this.close, this);
                this.edit = options.edit;
            },

            render: function () {
                $(this.el).html(template({instrument:this.model.toJSON(), edit: this.edit}));
                return this;
            },

            events: {
                "click .select" : "selectInstrument",
                "click .edit": "editInstrument"
            },

            editInstrument: function(event) {
                var url = event.target.href.substr(event.target.baseURI.length);
                router.navigate(url, {trigger: true});
                event.stopPropagation();
            },

            selectInstrument: function(event) {
                console.log('Instrument selected: ' + this.model.id);
                var theID = this.model.id;

                // Detect if we clicked on a new instrument or not:
                if (instrumentManager.getInstrument() && (this.model.id == instrumentManager.getInstrument().id)) {
                    // If so, just return to main screen
                    router.navigate('/', true);
                }
                // Now store the instrument ID in our settings
                // Note: this is only to remember it at next application start.
                settings.set({currentInstrument:theID});
                // If the settings changed, the router will pick this up since
                // it listens to change events in settings, and react accordingly.
                settings.save(null, {success: function() {
                }});
                return false;
            },
        });

    return Backbone.View.extend({

        initialize: function (options) {
            this.options = options || {};
        },

        render: function () {
            var instruments = this.model.models;
            var len = instruments.length;
            console.log("Instrument list: " + len + " instruments");
            
            if (len == 0) {
                $(this.el).html('<div class="col-md-12"><div class="row thumbnails"><div class="col-md-3 col-sm-2"><div class="thumbnail glowthumbnail select" style="text-align:center;"><a href="#" class="plain"><h5>No instrument</h5><p>There are no instruments setup in the application yet. Click on "Add Instrument" in the menu above to add one.</p></a></div></div></div></div>');
                return this;
            }

            var items = 4;
            var startPos = (this.options.page - 1) * items;
            var endPos = Math.min(startPos + items, len);

            $(this.el).html('<div class="col-md-12"><div class="row thumbnails"></div></div>');
            var editok = true;
            // Ask to hide the instrument setting in case we are a viewer or operator in server mode, because
            // the server won't let us retrieve the instrument parmeters anyway
            if (vizapp.type == 'server') {
                if (settings.get('currentUserRole') == 'viewer')
                    editok = false;
            }

            for (var i = startPos; i < endPos; i++) {
                $('.thumbnails', this.el).append(new InstrumentListItemView({model: instruments[i], edit: editok}).render().el);
            }

            $(this.el).append(new Paginator({model: this.model, page: this.options.page, viewname: 'instruments', items: items}).render().el);

            return this;
        }
    });

});