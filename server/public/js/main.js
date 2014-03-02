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
        "devicelogs/:id"        : "devicelogmanagement",
        "displaylogs/:ins/:loglist"  : "displaylogs",
        "editlogs/:ins/:loglist": "editlogs",
        "settings"              : "settings",
        "diagnostics/:id"       : "diagnostics",
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

        
        // When the current instrument model changes, we need to update
        // the link manager type:
        settings.on('change:currentInstrument', function(model, insId) {
            console.log('New instrument ID, updating the link manager type');
            var ins = new Instrument({_id: insId});
            ins.fetch({success: function(){
                var type = ins.get('type');
                console.log('New instrument type: ' + type );
                // Now update our Instrument manager:
                linkManager.closeInstrument();  // Stop former link manager
                instrumentManager.setInstrument(ins);
                linkManager.setDriver(instrumentManager.getLinkManager(linkManager));
            }});
        });
        
        
    },

    home: function (id) {
        console.log("Switching to home view");
        var homeView = new HomeView({model:settings});
        this.switchView(homeView);
        // homeView.addPlot();
        this.headerView.selectMenuItem('home-menu');
    },


    diagnostics: function (id) {
        var self = this;
        if (linkManager.connected) {
            console.log('Switching to the instrument diagnostics view');
            self.switchView(instrumentManager.getDiagDisplay({model: settings}));
            self.headerView.selectMenuItem('home-menu');    
        } else {
            app.navigate('/',true);
        }
    },
    
    // Display all logs known for the current instrument
    logmanagement: function() {
        var self = this;
        // Initialize with the list of logs for the current device:
        var logs = instrumentManager.getInstrument().logs;
        logs.fetch({
            success:function() {
                self.switchView(new LogManagementView({collection: logs}));
                self.headerView.selectMenuItem('management-menu');
            }});
    },
    
    // Display all selected logs. The list of logs is passed as the
    // view's collection
    displaylogs: function(id,loglist) {
        var self=this;
        // Loglist is a comma-separated list of log IDs
        var logarray = loglist.split(",");
        var allLogs = instrumentManager.getInstrument().logs;
        allLogs.fetch({success:function(){
            var myLogs = allLogs.getLogSubset(logarray);
            self.switchView(instrumentManager.getLogView({collection:myLogs}));
        }});
    },

    // Edit all selected logs. The list of logs is passed as the
    // view's collection
    editlogs: function(id,loglist) {
        var self=this;
        // Loglist is a comma-separated list of log IDs
        var logarray = loglist.split(",");
        var allLogs = instrumentManager.getInstrument().logs;
        allLogs.fetch({success:function(){
            var myLogs = allLogs.getLogSubset(logarray);
            self.switchView(instrumentManager.getLogEditView({collection:myLogs}));
        }});
    },
    
    // Launch log management interface for the device. All existing logs
    // are passed to the view, so that it can easily understand whether a log
    // is already downloaded in the database or not.
    devicelogmanagement: function(id) {
        var self = this;
        if (linkManager.connected) {
            var allLogs = instrumentManager.getInstrument().logs;
            allLogs.fetch({success:function(){
                self.switchView(instrumentManager.getLogManagementView({collection:allLogs}));
                self.headerView.selectMenuItem('management-menu');
            }});
        } else {
            app.navigate('/',true);
        }
                         
    },
    
    // Instrument management
    listInstruments: function(page) {
        var self = this;
        var p = page ? parseInt(page, 10) : 1;
        var instrumentList = new InstrumentCollection();
        instrumentList.fetch({success: function(){
            self.switchView(new InstrumentListView({model: instrumentList, page: p}));
        }});
        this.headerView.selectMenuItem('instrument-menu');
        
    },
    
    addInstrument: function() {
        var self = this;
        var instrument = new Instrument();
        this.switchView(new InstrumentDetailsView({model: instrument}));
        this.headerView.selectMenuItem('instrument-menu');
        
    },
    
    instrumentDetails: function(id) {
        var self = this;
        var instrument = new Instrument({_id: id});
        instrument.fetch({success: function(){
            self.switchView(new InstrumentDetailsView({model: instrument}));
        }});
        this.headerView.selectMenuItem('instrument-menu');

    },
    
    // Workspace management

    listWorkspaces: function(page) {
        var self = this;
        var p = page ? parseInt(page, 10) : 1;
        var workspaceList = new WorkspaceCollection();
        workspaceList.fetch({success: function(){
            self.switchView(new WorkspaceListView({model: workspaceList, page: p}));
        }});
        this.headerView.selectMenuItem('workspace-menu');
        
    },
    
    addWorkspace: function() {
        // TODO: pop up a modal to select an instrument type, and create the instrument
        var workspace = new Workspace();
        this.switchView(new WorkspaceView({model: workspace}));
        this.headerView.selectMenuItem('workspace-menu');
        
    },


    about: function () {
        var aboutView = new AboutView();
        this.switchView(aboutView);
        this.headerView.selectMenuItem('about-menu');
    },
    
    settings: function () {
        var settingsView = new SettingsView({model: settings});
        this.switchView(settingsView);
        this.headerView.selectMenuItem('settings-menu');
    },

});


utils.loadTemplate(['HomeView', 'HeaderView', 'AboutView', 'SettingsView', 'LogManagementView', 'InstrumentDetailsView',
                    'InstrumentListItemView', 'instruments/OnyxLiveView', 'instruments/Fluke289LiveView',
                    'instruments/OnyxLogEditView',
                    'instruments/FCOledLiveView',
                    'instruments/OnyxNumView', 'instruments/FCOledNumView', 'instruments/Fluke289NumView', 'instruments/Fluke289DiagView',
                    'instruments/OnyxLogView', 'instruments/Fluke289LogView', 'instruments/Fluke289LogManagementView', 'instruments/OnyxLogManagementView',
                    'instruments/OnyxDiagView', 'instruments/W433LiveView', 'instruments/W433NumView', 'instruments/W433SettingsView',
                    'instruments/W433LogView',  'instruments/FCOledLogView', 'instruments/ElecraftLiveView', 'instruments/ElecraftNumView', 
                    'instruments/ElecraftDiagView', 'instruments/ElecraftFrequencyItemView'
                   ],
    function() {
        
        // Get our settings here, and
        // share them afterwards, rather than requesting it
        // everytime...
        settings = new Settings({id: 1 });
        // We need to be sure the settings are fetched before moving
        // further, so we add the Ajax option "async" below.
        settings.fetch({async:false});

        // Now create our instrument manager & link manager (todo: have only one object ?)

        // Create our instrument manager: in charge of creating/deleting
        // instruments as necessary, as well as providing a list of
        // instruments to other parts who need those
        instrumentManager = new InstrumentManager();
                       
        // Create our link manager: it is in charge of talking
        // to the server-side controller interface through a socket.io
        // web socket. It is passed to all views that need it.
        linkManager =  new LinkManager();
        var insId = settings.get('currentInstrument');
        if (insId != null) {
            var ins = new Instrument({_id: insId});
            ins.fetch({success: function(){
                // We have the instrument, get the correct link manager for it:
                var type = ins.get('type');
                console.log('Load link manager driver for type: ' + type );
                instrumentManager.setInstrument(ins);
                linkManager.setDriver(instrumentManager.getLinkManager(linkManager));

                app = new AppRouter();
                Backbone.history.start();
            }});
        } else {
	   app = new AppRouter();
	   Backbone.history.start();
	}
});
