// Desklet : Sticky Notes           Version      : v1.3-Beta
// O.S.    : Cinnamon               Release Date : 18 August 2014.
// Author  : Lester Carballo Pérez  Email        : lestcape@gmail.com
//
// Website : https://github.com/lestcape/Sticky-Notes
//
// Based on: https://github.com/linuxmint/Cinnamon/pull/2119
//
// This is a simple desklet to add sticky notes in the desktop.
// The notes will be saved when a focus of the text editor was lost.
//
//    This program is free software:
//
//    You can redistribute it and/or modify it under the terms of the
//    GNU General Public License as published by the Free Software
//    Foundation, either version 3 of the License, or (at your option)
//    any later version.
//
//    This program is distributed in the hope that it will be useful,
//    but WITHOUT ANY WARRANTY; without even the implied warranty of
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//    GNU General Public License for more details.
//
//    You should have received a copy of the GNU General Public License
//    along with this program.  If not, see <http://www.gnu.org/licenses/>.
//

const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const AppletManager = imports.ui.appletManager;
const Applet = imports.ui.applet;
//const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;
const Main = imports.ui.main;
const Lang = imports.lang;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const FALLBACK_ICON_HEIGHT = 22;

function _(str) {
   let resultConf = Gettext.dgettext("stickyNotes@lestcape", str);
   if(resultConf != str) {
      return resultConf;
   }
   return Gettext.gettext(str);
}

function MyApplet(orientation, panel_height, instanceId) {
   this._init(orientation, panel_height, instanceId);
}

MyApplet.prototype = {
   __proto__: Applet.Applet.prototype,

   _init: function(orientation, panel_height, instanceId) {
      Applet.Applet.prototype._init.call(this, orientation, panel_height, instanceId);

      this.desklet = null;
      try {
         Gettext.bindtextdomain("stickyNotes@lestcape", GLib.get_home_dir() + "/.local/share/locale");
         this.mainBox = new St.BoxLayout();
         this.menuManager = new PopupMenu.PopupMenuManager(this);
         this.menu = new Applet.AppletPopupMenu(this, orientation);
         this.menuManager.addMenu(this.menu);
         this.context_menu_item_collapse = new Applet.MenuItem(_("Collapse"), "dialog-question", Lang.bind(this, function(actor) {
            if(this.desklet) {
               this.desklet._appletCollapsed = !this.desklet._appletCollapsed;
               this._onSetAppletType(this.desklet._appletCollapsed, this.desklet._appletSymbolic);
            }
         }));
         this._applet_context_menu.addMenuItem(this.context_menu_item_collapse);

         this.appletBox = new AppletIconsBox(this, panel_height, St.IconType.FULLCOLOR);
         this.actor.add(this.appletBox.actor, { y_align: St.Align.MIDDLE, y_fill: false });
      }
      catch(e) {
         Main.notify("appletError", e.message);
         global.logError(e);
      }
   },

   _onSetAppletType: function(collapsed, symbolic) {
      try {
         if(this.appletBox) {
            if(this.menu.isOpen)
               this.menu.close();
            this.menu.removeAll();
            this.appletBox.remove_all();
            this.btAddNote = null;
            this.btRaiseNote = null;
            this.btHideNote = null;
            this.btMultInstance = null;
            this.menuAddNote = null;
            this.menuRaiseNotes = null;
            this.menuHideNotes = null;
            this.menuMultInstance = null;
            //let boxParent = this.appletBox.actor.get_parent();
            //if(boxParent) boxParent.remove_actor(this.appletBox.actor);
            if(symbolic)
               this.appletBox.set_icon_type(St.IconType.SYMBOLIC);
            else
               this.appletBox.set_icon_type(St.IconType.FULLCOLOR);
            if(collapsed) {
               this.context_menu_item_collapse._icon = "go-up";
               this.context_menu_item_collapse.icon.set_icon_name(this.context_menu_item_collapse._icon);
               this.context_menu_item_collapse._text = _("Collapse");
               this.context_menu_item_collapse.label.set_text(this.context_menu_item_collapse._text);
   
               this.btAddNote = this.appletBox.add_applet_icon_name("list-add");
               this.btAddNote.connect('notify::hover', Lang.bind(this, function(actor) {
                  if(actor.get_hover()) {
                     this.set_applet_tooltip(_("Add new Note"));
                  }
               }));
               this.btAddNote.connect('button-press-event', Lang.bind(this, this.addNewNote));
               //if(this.desklet.deskletRaised)
               //   this.btRaiseNote = this.appletBox.add_applet_icon_name("go-down");
               //else
                  this.btRaiseNote = this.appletBox.add_applet_icon_name("go-up");
               this.btRaiseNote.connect('notify::hover', Lang.bind(this, function(actor) {
                  if(actor.get_hover()) {
                     //if(this.desklet.deskletRaised)
                        this.set_applet_tooltip(_("Raise Notes"));
                     /*else
                        this.set_applet_tooltip(_("Unraise Notes"));*/
                  }
               }));
               this.btRaiseNote.connect('button-press-event', Lang.bind(this, this.raiseNotes));
               if(this.desklet.deskletHide)
                  this.btHideNote = this.appletBox.add_applet_icon_name("starred");
               else
                  this.btHideNote = this.appletBox.add_applet_icon_name("non-starred");
               this.btHideNote.connect('notify::hover', Lang.bind(this, function(actor) {
                  if(actor.get_hover()) {
                     if(this.desklet.deskletHide)
                        this.set_applet_tooltip(_("Show Notes"));
                     else
                        this.set_applet_tooltip(_("Hide Notes"));
                  }
               }));
               this.btHideNote.connect('button-press-event', Lang.bind(this, this.hideNotes));
               /*if(this.desklet._multInstance)
                  this.btMultInstance = this.appletBox.add_applet_icon_name("window-maximize");//user-invisible
               else*/
                  this.btMultInstance = this.appletBox.add_applet_icon_name("input-dialpad");
               this.btMultInstance.connect('notify::hover', Lang.bind(this, function(actor) {
                  if(actor.get_hover()) {
                     if(this.desklet._multInstance)
                        this.set_applet_tooltip(_("Single Instance"));
                     else
                        this.set_applet_tooltip(_("Multiple Instances"));
                  }
               }));
               this.btMultInstance.connect('button-press-event', Lang.bind(this, this.tryMultInstance));
            } else {
               this.context_menu_item_collapse._icon = "go-down";
               this.context_menu_item_collapse.icon.set_icon_name(this.context_menu_item_collapse._icon);
               this.context_menu_item_collapse._text = _("Expand");
               this.context_menu_item_collapse.label.set_text(this.context_menu_item_collapse._text);
               this.menuAddNote = new Applet.MenuItem(_("Add new Note"), "list-add", Lang.bind(this, this.addNewNote));
               this.menu.addMenuItem(this.menuAddNote);
               let context_menu_separator = new PopupMenu.PopupSeparatorMenuItem();
               this.menu.addMenuItem(context_menu_separator);
               /*if(this.desklet.deskletRaised)
                  this.menuRaiseNotes = new Applet.MenuItem(_("Unraise Notes"), "go-down", Lang.bind(this, this.raiseNotes));
               else*/
                  this.menuRaiseNotes = new Applet.MenuItem(_("Raise Notes"), "go-up", Lang.bind(this, this.tryRaiseNotes));
               this.menu.addMenuItem(this.menuRaiseNotes);
               if(this.desklet.deskletHide)
                  this.menuHideNotes = new Applet.MenuItem(_("Show Notes"), "starred", Lang.bind(this, this.hideNotes));
               else
                  this.menuHideNotes = new Applet.MenuItem(_("Hide Notes"), "non-starred", Lang.bind(this, this.hideNotes));
               this.menu.addMenuItem(this.menuHideNotes);
               context_menu_separator = new PopupMenu.PopupSeparatorMenuItem();
               this.menu.addMenuItem(context_menu_separator);
               this.menuMultInstance = new ConfigurablePopupSwitchMenuItem(_("Multiple Instances"), "input-dialpad", "input-dialpad", this.desklet._multInstance);
               this.menuMultInstance.connect('activate', Lang.bind(this, function() {
                  this.multInstance();
               }));
               this.menu.addMenuItem(this.menuMultInstance);

               this.appletNote = this.appletBox.add_applet_icon_name("text-editor");
               this.set_applet_tooltip(_("Sticky Notes Manager"));
               this.appletNote.connect('button-press-event', Lang.bind(this, function(actor, event) {
                  if((this._draggable)&&(!this._draggable.inhibit))
                     return false;
                  if(event.get_button() == 1) {
                     this.menu.toggle();
                  }
                  return false;
               }));
               //this.mainBox.add(this.appletBox.actor, { y_align: St.Align.MIDDLE, y_fill: false });
            }
         }
      } catch(e) {
         Main.notify("err", e.message);
      }
   },

   addNewNote: function (actor, event) {
      if((this._draggable)&&(!this._draggable.inhibit))
         return false;
      if(event.get_button() == 1) {
         this.desklet._onAddNote();
      }
      return false;
   },

   tryRaiseNotes: function (actor, event) {
      //if(event.get_button() == 1) {
         //Main.notify("Hola Raise");
         Mainloop.idle_add(Lang.bind(this, function() {
            this.desklet.toggleRaise();
         }));
     // }
   },

   raiseNotes: function (actor, event) {
      if((this._draggable)&&(!this._draggable.inhibit))
         return false;
      if(event.get_button() == 1) {
         //Main.notify("Hola Raise");
         this.desklet.toggleRaise();
      }
      return false;
   },

   hideNotes: function (actor, event) {
      if((this._draggable)&&(!this._draggable.inhibit))
         return false;
      if(event.get_button() == 1) {
         this.desklet.toggleHide();
      }
      return false;
   },

   tryMultInstance: function (actor, event) {
      if((this._draggable)&&(!this._draggable.inhibit))
         return false;
      if(event.get_button() == 1) {
         this.multInstance();
      }
      return false;
   },

   multInstance: function () {
      Mainloop.idle_add(Lang.bind(this, function() {
         let activeMultInstance = !this.desklet._multInstance;
         if(this.menuMultInstance) {
            this.menuMultInstance._switch.state = !this.menuMultInstance._switch.state;
            activeMultInstance = this.menuMultInstance._switch.state;
         }
         this.desklet.multInstanceMenuItem._switch.state = activeMultInstance;
         this.desklet._onMultInstanceActivated();
      }));
   },

   setRaiseStatus: function (raise) {
   /*   if(this.btRaiseNote) {
         if(raise)
            this.btRaiseNote.set_icon_name("go-down");
         else
            this.btRaiseNote.set_icon_name("go-up");
      }
      if(this.menuRaiseNotes) {
         if(raise) {
            this.menuRaiseNotes._icon = "go-down";
            this.menuRaiseNotes.icon.set_icon_name(this.menuRaiseNotes._icon);
            this.menuRaiseNotes._text = _("Unraise Notes");
            this.menuRaiseNotes.label.set_text(this.menuRaiseNotes._text);
         }
         else {
            this.menuRaiseNotes._icon = "go-up";
            this.menuRaiseNotes.icon.set_icon_name(this.menuRaiseNotes._icon);
            this.menuRaiseNotes._text = _("Raise Notes");
            this.menuRaiseNotes.label.set_text(this.menuRaiseNotes._text);
         }
      }*/
   },

   setHideStatus: function (hide) {
      if(this.btRaiseNote) {
         if(hide)
            this.btHideNote.set_icon_name("starred");
         else
            this.btHideNote.set_icon_name("non-starred");
      }
      if(this.menuHideNotes) {
         if(hide) {
            this.menuHideNotes._icon = "starred";
            this.menuHideNotes.icon.set_icon_name(this.menuHideNotes._icon);
            this.menuHideNotes._text = ("Show Notes");
            this.menuHideNotes.label.set_text(this.menuHideNotes._text);
         }
         else {
            this.menuHideNotes._icon = "non-starred";
            this.menuHideNotes.icon.set_icon_name(this.menuHideNotes._icon);
            this.menuHideNotes._text = _("Hide Notes");
            this.menuHideNotes.label.set_text(this.menuHideNotes._text);
         }
      }
   },

   setParentDesklet: function (desklet) {
      this.desklet = desklet;
      this._onSetAppletType(this.desklet._appletCollapsed, this.desklet._appletSymbolic);
   },

   removedFromPanel: function() {
      if(this.desklet) {
         this.desklet.on_applet_removed_from_panel();
      }
   },

   on_applet_removed_from_panel: function() {
   },

   on_panel_height_changed: function() {
      if(this.appletBox)
         this.appletBox.set_panel_height(this._panelHeight);
   },
   
   finalizeContextMenu: function () {
      try {
         // Add default context menus if we're in panel edit mode, ensure their removal if we're not       
         let items = this._applet_context_menu._getMenuItems();

         if(this.context_menu_item_remove == null) {
            this.context_menu_item_remove = new Applet.MenuItem(_("Remove this applet"), "edit-delete",
                                                                Lang.bind(this, this.removedFromPanel));
         }

         if((this.openAbout)&&(this.context_menu_item_about == null)) {
            this.context_menu_item_about = new Applet.MenuItem(_("About..."), "dialog-question", Lang.bind(this, this.openAbout));
         }

         if(this.context_menu_separator == null) {
            this.context_menu_separator = new PopupMenu.PopupSeparatorMenuItem();
         }

         if(this._applet_context_menu._getMenuItems().length > 0) {
            this._applet_context_menu.addMenuItem(this.context_menu_separator);
         }

         if((this.context_menu_item_about)&&(items.indexOf(this.context_menu_item_about) == -1)) {
            this._applet_context_menu.addMenuItem(this.context_menu_item_about);
         }

         if(!this._meta["hide-configuration"] && GLib.file_test(this._meta["path"] + "/settings-schema.json", GLib.FileTest.EXISTS)) {     
            if(this.context_menu_item_configure == null) {           
               this.context_menu_item_configure = new Applet.MenuItem(_("Configure..."), "system-run", Lang.bind(this, function() {
                  Util.spawnCommandLine("cinnamon-settings desklets " + this._uuid + " " + this.desklet.instance_id);
               }));
            }
            if(items.indexOf(this.context_menu_item_configure) == -1) {
               this._applet_context_menu.addMenuItem(this.context_menu_item_configure);
            }
         }

         if(items.indexOf(this.context_menu_item_remove) == -1) {
            this._applet_context_menu.addMenuItem(this.context_menu_item_remove);
         }
      } catch(e) {
         global.logError(e);
      }
   }
};

function ConfigurablePopupSwitchMenuItem() {
   this._init.apply(this, arguments);
}

ConfigurablePopupSwitchMenuItem.prototype = {
   __proto__: PopupMenu.PopupBaseMenuItem.prototype,

   _init: function(text, imageOn, imageOff, active, params) {
      PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);

      this._imageOn = imageOn;
      this._imageOff = imageOff;

      let table = new St.Table({ homogeneous: false, reactive: true });

      this.label = new St.Label({ text: text });
      this.label.set_margin_left(6.0);

      this._switch = new PopupMenu.Switch(active);

      if(active)
         this.icon = new St.Icon({ icon_name: this._imageOn, icon_type: St.IconType.FULLCOLOR, style_class: 'popup-menu-icon' });
      else
         this.icon = new St.Icon({ icon_name: this._imageOff, icon_type: St.IconType.FULLCOLOR, style_class: 'popup-menu-icon' });

      this._statusBin = new St.Bin({ x_align: St.Align.END });
      this._statusBin.set_margin_left(6.0);
      this._statusLabel = new St.Label({ text: '', style_class: 'popup-inactive-menu-item' });
      this._statusBin.child = this._switch.actor;

      table.add(this.icon, {row: 0, col: 0, col_span: 1, x_expand: false, x_align: St.Align.START});
      table.add(this.label, {row: 0, col: 1, col_span: 1, y_fill: false, y_expand: true, x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE});
      table.add(this._statusBin, {row: 0, col: 2, col_span: 1, x_expand: true, x_align: St.Align.END});

      this.addActor(table, { expand: true, span: 1, align: St.Align.START});
   },

    setToggleState: function(state) {
        if(state)
           this.icon.set_icon_name(this._imageOn);
        else
           this.icon.set_icon_name(this._imageOff);
        this._switch.setToggleState(state);
    },

    get_state: function() {
        return this._switch.state;
    }
};

function AppletIconsBox(parent, box_height, icon_type) {
   this._init(parent, box_height, icon_type);
}

AppletIconsBox.prototype = {
   _init: function(parent, box_height, icon_type) {
      this.parent = parent;
      this._boxHeight = box_height;
      this._icon_type = icon_type;
      this._scaleMode = global.settings.get_boolean('panel-scale-text-icons') && global.settings.get_boolean('panel-resizable');
      this.actor = new St.BoxLayout();
      this.set_icon_type(icon_type);
   },

   set_icon_type: function (icon_type) {
      this._icon_type = icon_type;
      let childs = this.actor.get_children();
      for(let ch in childs) {
         childs[ch].set_icon_type(this._icon_type);
         if(this._icon_type == St.IconType.FULLCOLOR)
            childs[ch].style_class = 'applet-icon';
         else
            childs[ch].style_class = 'system-status-icon'; 
         if(this._scaleMode) {
            if(this._icon_type == St.IconType.FULLCOLOR)
               childs[ch].set_icon_size(this._boxHeight * Applet.COLOR_ICON_HEIGHT_FACTOR / global.ui_scale);
            else
               childs[ch].set_icon_size((this._boxHeight / Applet.DEFAULT_PANEL_HEIGHT) * Applet.PANEL_SYMBOLIC_ICON_DEFAULT_HEIGHT / global.ui_scale);
         } else {
            if(this._icon_type == St.IconType.FULLCOLOR)
               childs[ch].set_icon_size(FALLBACK_ICON_HEIGHT);
            else
               childs[ch].set_icon_size(-1);
         }
      }
   },

   add_applet_icon_name: function (icon_name) {
      let applet_icon = new St.Icon({icon_name: icon_name, reactive: true, track_hover: true });
      applet_icon.set_icon_type(this._icon_type);
      if(this._icon_type == St.IconType.FULLCOLOR)
         applet_icon.style_class = 'applet-icon';
      else
         applet_icon.style_class = 'system-status-icon';
      if(this._scaleMode) {
         if(this._icon_type == St.IconType.FULLCOLOR)
            applet_icon.set_icon_size(this._boxHeight * Applet.COLOR_ICON_HEIGHT_FACTOR / global.ui_scale);
         else
            applet_icon.set_icon_size((this._boxHeight / Applet.DEFAULT_PANEL_HEIGHT) * Applet.PANEL_SYMBOLIC_ICON_DEFAULT_HEIGHT / global.ui_scale);
      } else {
         if(this._icon_type == St.IconType.FULLCOLOR)
            applet_icon.set_icon_size(FALLBACK_ICON_HEIGHT);
         else
            applet_icon.set_icon_size(-1);
      }
      this.actor.add_actor(applet_icon);
      return applet_icon;
   },

   remove_all: function () {
      this.actor.destroy_all_children();
   },

   set_panel_height: function(box_height) {
      this._boxHeight = box_height;
      this._scaleMode = global.settings.get_boolean('panel-scale-text-icons') && global.settings.get_boolean('panel-resizable');
      this.set_icon_type(this._icon_type);
    }
};

function main(metadata, orientation, panel_height, instanceId) {
    let myApplet = new MyApplet(orientation, panel_height, instanceId);
    return myApplet;
}
