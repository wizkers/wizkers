/**
 * Where we define the routes in our Backbone application
 */

var AppRouter = Backbone.Router.extend({

    routes: {
        ""                      : "home",
        "instruments"           : "listInstruments",
        "instruments/page/:page": "listInstruments",
        "instruments/add"       : "addInstrument",
        "instruments/:id"       : "instrumentDetails",
        "workspaces"            : "listWorkspaces",
        "workspaces/page/:page" : "listWorkspaces",
        "workspaces/add"        : "addWorkspace",
        "workspaces/:id"        : "workspaceDetails",
        "logmgt"                : "logmanagement",
        "settings"              : "settings",
        "diagnostics"           : "diagnostics",
        "about"                 : "about",
    },
    
    currentView: null,
    
    switchView: function(view) {
        if (this.currentView) {
            this.currentView.remove();
            if (this.currentView.onClose){
                    this.currentView.onClose();
            }
        }
        $('#content').html(view.el);
        view.render();
        this.currentView = view;
    },

    initialize: function () {
        var self = this;
        console.log("Initializing application");
        this.headerView = new HeaderView();
        $('.header').html(this.headerView.el);
        // Get our settings here, and
        // share them afterwards, rather than requesting it
        // everytime...
        this.settings = new Settings({id: 1 });
        // We need to be sure the settings are fetched before moving
        // further, so we add the Ajax option "async" below.
        this.settings.fetch({async:false});
        
        // When the current instrument model changes, we need to update
        // the link manager type:
        this.settings.on('change:currentInstrument', function(model, insId) {
            console.log('New instrument ID, updating the link manager type');
            var ins = new Instrument({_id: insId});
            ins.fetch({success: function(){
                // We have the instrument, get the correct link manager for it:
                var type = ins.get('type');
                console.log('Ins type: ' + type );
                self.linkManager.closePort();  // Stop former link manager
                self.linkManager.setDriver(self.instrumentManager.getLinkManager(type, self.linkManager));
            }});

        });
        
        
        // Create our instrument manager: in charge of creating/deleting
        // instruments as necessary, as well as providing a list of
        // instruments to other parts who need those
        this.instrumentManager = new instrumentManager();

        // Create our link manager: it is in charge of talking
        // to the server-side controller interface through a socket.io
        // web socket. It is passed to all views who need it.
        this.linkManager =  new linkManager();
        var insId = this.settings.get('currentInstrument');
        if (insId != null) {
            var ins = new Instrument({_id: insId});
            ins.fetch({success: function(){
                // We have the instrument, get the correct link manager for it:
                var type = ins.get('type');
                console.log('Load link manager driver for type: ' + type );
                self.linkManager.setDriver(self.instrumentManager.getLinkManager(type ,self.linkManager));
            }});
        }

        
    },

    home: function (id) {
        console.log("Switching to home view");
        var homeView = new HomeView({model: this.settings, lm: this.linkManager, im: this.instrumentManager});
        this.switchView(homeView);
        // homeView.addPlot();
        this.headerView.selectMenuItem('home-menu');
    },


    diagnostics: function () {
        //$("#content").html(new DiagnosticsView({model: this.settings, lm: this.linkManager}).el);
        this.switchView(new DiagnosticsView({model: this.settings, lm: this.linkManager}));
        this.headerView.selectMenuItem('home-menu');
    },
    
    logmanagement: function() {
        var devices = new OnyxCollection();
        devices.fetch({async:false});
        this.switchView(new LogManagementView({collection: devices, settings: this.settings}));
        this.headerView.selectMenuItem('management-menu');
    },
    
    // Instrument management
    
    listInstruments: function(page) {
        var self = this;
        var p = page ? parseInt(page, 10) : 1;
        var instrumentList = new InstrumentCollection();
        instrumentList.fetch({success: function(){
            self.switchView(new InstrumentListView({model: instrumentList, settings: self.settings, page: p}));
        }});
        this.headerView.selectMenuItem('instrument-menu');
        
    },
    
    addInstrument: function() {
        var self = this;
        var instrument = new Instrument();
        this.switchView(new InstrumentDetailsView({model: instrument, lm:self.linkManager, im:self.instrumentManager}));
        this.headerView.selectMenuItem('instrument-menu');
        
    },
    
    instrumentDetails: function(id) {
        var self = this;
        var instrument = new Instrument({_id: id});
        instrument.fetch({success: function(){
            self.switchView(new InstrumentDetailsView({model: instrument, lm:self.linkManager, im:self.instrumentManager}));
        }});
        this.headerView.selectMenuItem('instrument-menu');

    },
    
    // Workspace management

    listWorkspaces: function(page) {
        var self = this;
        var p = page ? parseInt(page, 10) : 1;
        var workspaceList = new WorkspaceCollection();
        workspaceList.fetch({success: function(){
            self.switchView(new WorkspaceListView({model: workspaceList, settings: self.settings, page: p}));
        }});
        this.headerView.selectMenuItem('workspace-menu');
        
    },
    
    addWorkspace: function() {
        // TODO: pop up a modal to select an instrument type, and create the instrument
        var workspace = new Workspace();
        this.switchView(new WorkspaceView({model: workspace, lm:self.linkManager}));
        this.headerView.selectMenuItem('workspace-menu');
        
    },


    about: function () {
        var aboutView = new AboutView();
        this.switchView(aboutView);
        this.headerView.selectMenuItem('about-menu');
    },
    
    settings: function () {
        var settingsView = new SettingsView({model: this.settings});
        this.switchView(settingsView);
        this.headerView.selectMenuItem('settings-menu');
    },

});


utils.loadTemplate(['HomeView', 'HeaderView', 'AboutView', 'DiagnosticsView', 'SettingsView', 'LogManagementView', 'InstrumentDetailsView',
                    'InstrumentListItemView', 'instruments/OnyxLiveView', 'instruments/Fluke289LiveView', 'instruments/FCOledLiveView',
                    'instruments/OnyxNumView', 'instruments/FCOledNumView', 'instruments/Fluke289NumView',
                   ], function() {
    app = new AppRouter();
    
    // Now register all known intrument types in the app's intsrument manager
                       
    Backbone.history.start();
});
