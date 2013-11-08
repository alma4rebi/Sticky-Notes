// Desklet : Sticky Notes           Version      : v0.1-Beta
// O.S.    : Cinnamon               Release Date : 07 November 2013.
// Author  : Lester Carballo Pérez  Email        : lestcape@gmail.com
//
// Website : https://github.com/lestcape/Notes
//
// Based on: https://github.com/linuxmint/Cinnamon/pull/2119
//
// This is a simple desklet to add notes in the desktop.
// The Notes will be saved when a focus of the text editor was lost.
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

const Lang = imports.lang;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const Cinnamon = imports.gi.Cinnamon;
const Desklet = imports.ui.desklet;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Tooltips = imports.ui.tooltips;
const Settings = imports.ui.settings;
//const Mainloop = imports.mainloop;
//const Gtk = imports.gi.Gtk;
//const CinnamonEntry = imports.ui.cinnamonEntry;
const Util = imports.misc.util;


function _EntryMenu(entry) {
    this._init(entry);
}

_EntryMenu.prototype = {
   __proto__: PopupMenu.PopupMenu.prototype,

   _init: function(entry) {

      PopupMenu.PopupMenu.prototype._init.call(this, entry, 0, St.Side.TOP);

      this.actor.add_style_class_name('entry-context-menu');

      this._entry = entry;
      this._clipboard = St.Clipboard.get_default();

      // Populate menu
      let item;
      item = new PopupMenu.PopupMenuItem(_("Copy"));
      item.connect('activate', Lang.bind(this, this._onCopyActivated));
      this.addMenuItem(item);
      this._copyItem = item;

      item = new PopupMenu.PopupMenuItem(_("Paste"));
      item.connect('activate', Lang.bind(this, this._onPasteActivated));
      this.addMenuItem(item);
      this._pasteItem = item;

      this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      let item;
      item = new PopupMenu.PopupMenuItem(_("Delete"));
      item.connect('activate', Lang.bind(this, this._onDeleteActivated));
      this.addMenuItem(item);
      this._deleteItem = item;

      Main.uiGroup.add_actor(this.actor);
      this.actor.hide();
   },

   open: function() {
      this._updatePasteItem();
      this._updateCopyItem();

      //let direction = Gtk.DirectionType.TAB_FORWARD;
      /*if (!this.actor.navigate_focus(null, direction, false))
         this.actor.grab_key_focus();*/

      PopupMenu.PopupMenu.prototype.open.call(this);
   },

   _updateCopyItem: function() {
      this.selection = this._entry.clutter_text.get_selection();
      this._copyItem.setSensitive(this.selection && this.selection != '');
      this._deleteItem.setSensitive(this.selection && this.selection != '');
      this.selectBounds = this._entry.clutter_text.get_selection_bound();
   },

   _updatePasteItem: function() {
      this._clipboard.get_text(Lang.bind(this,
         function(clipboard, text) {
            this._pasteItem.setSensitive(text && text != '');
         }));
    },

    _onCopyActivated: function() {
       //let selection = this._entry.clutter_text.get_selection();
       this._clipboard.set_text(this.selection);
    },

    _onPasteActivated: function() {
       this._clipboard.get_text(Lang.bind(this,
          function(clipboard, text) {
             if (!text)
                return;
             this._entry.clutter_text.delete_selection();
             let pos = this._entry.clutter_text.get_cursor_position();
             this._entry.clutter_text.insert_text(text, pos);
          }));
    },

    _onDeleteActivated: function() {
      // this._entry.clutter_text.delete_selection();
       this._entry.clutter_text.delete_text(this.selectBounds - this.selection.length, this.selectBounds);
    }
};

function MyDesklet(metadata, desklet_id){
   this._init(metadata, desklet_id);
}

MyDesklet.prototype = {
   __proto__: Desklet.Desklet.prototype,

   _init: function(metadata, desklet_id){
      Desklet.Desklet.prototype._init.call(this, metadata, desklet_id);

      this.metadata = metadata;
      this.instance_id = desklet_id;
      this.setHeader(_("Sticky Notes"));

      this.helpFile = GLib.get_home_dir() + "/.local/share/cinnamon/desklets/"+this.metadata["uuid"]+"/" + _("README");
      this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());		
      this._menu.addAction(_("Help"), Lang.bind(this, function() {
         Util.spawnCommandLine("xdg-open " + this.helpFile);
      }));
      this._menu.addAction(_("Web Site"), Lang.bind(this, function() {
         Util.spawnCommandLine("xdg-open " + "http://github.com/lestcape/Notes");
      }));

      this._text = "";
      this.noteCurrent = 0;
      this._boxColor = "#000000";
      this._transparency = 50;
      this._borderBoxWidth = 1;
      this._borderBoxColor = "#ffffff";
      this._textSize = 9;
      this._fontFamily = ""; //Default Font family
      this._fontColor= "#ffffff";
      this._fWidth = false;
      this._width = 170;
      this.focusIDSignal = 0;
      this.keyPressIDSignal = 0;
      try {
         this._initDeskletContruction();
         this.notesList = this.readNotesFromFile();
         this._initSettings();
         this.clutterText.connect('button-press-event', Lang.bind(this, this._onButtonPress));        

         this._createMenu();

         this.setContent(this.mainBox);
      } catch(e) {
         this.showErrorMessage(e.message);
      }
   },

   showErrorMessage: function(menssage) {
      Main.notifyError(_("Error"), menssage);
   },

   newNote: function(noteMessage) {
      if((noteMessage)&&(noteMessage != "")&&(noteMessage != _("Type to your note..."))) {
         if((this.notesList.length == 0)||(this.noteCurrent > this.notesList.length)) {
            try {
               let maxValue = 0;
               let currValue, textVal;
               for(pos in this.notesList) {
                  currValue = parseInt(this.notesList[pos][0]);
                  if(currValue > maxValue)
                     maxValue = currValue;
               }
               this.noteCurrent = this.notesList.length;
               let strinName = (maxValue + 1).toString();
               this.notesList.push([strinName, noteMessage]);
               this.writeNoteToFile(this.noteCurrent);
               this.numberNote.set_text(this.notesList.length.toString());
               this.noteCurrent = this.notesList.length;
               this.currentNote.set_text(this.noteCurrent.toString());
            } catch(e) {
               this.showErrorMessage(e.message);
            }
         } else if(this.notesList[this.noteCurrent - 1][1] != noteMessage) {
            this.notesList[this.noteCurrent - 1][1] = noteMessage;
            this.writeNoteToFile(this.noteCurrent - 1);
         }
      }
   },

   writeNoteToFile: function(pos) {
      if((pos > -1)&&(pos < this.notesList.length)) {
         try {
            let output_file = Gio.file_new_for_path(GLib.get_home_dir() + "/.local/share/notes/" + this.notesList[pos][0] + ".note");
            this._makeDirectoy(output_file.get_parent());
            this.deleteNote(pos);
            let fstream = output_file.replace("", false, Gio.FileCreateFlags.NONE, null);
            let dstream = new Gio.DataOutputStream.new(fstream);   

            dstream.put_string(this.notesList[pos][1], null);
            fstream.close(null);
            return true;
         } catch(e) {
            this.showErrorMessage(e.message);
         }
      }
      
   },

   deleteNote: function(pos) {
      if((pos > -1)&&(pos < this.notesList.length)) {
         let file = Gio.file_new_for_path(GLib.get_home_dir() + "/.local/share/notes/" + this.notesList[pos][0] + ".note");
         if(file.query_exists(null))
            return file.delete(null);
      } 
      return false;
   },

   readNotesFromFile: function() {
      let notes = this.findNotesFromFile();
      try {   
         for(pos in notes) {
            let file = Gio.file_new_for_path(GLib.get_home_dir() + "/.local/share/notes/" + notes[pos][0] + ".note");
            if(file.query_exists(null))
            {
               try {
                  let fstream = file.read(null);
                  let dstream = new Gio.DataInputStream.new(fstream);
                  let data = dstream.read_until("", null);
                  fstream.close(null);
                  notes[pos][1] = data[0];
               } catch(e) {
                  this.showErrorMessage(e.message);
               }
            } else
               this.showErrorMessage(e.message);
         }
         this.noteCurrent = 0;
         this.currentNote.set_text("1");
         this.numberNote.set_text(notes.length.toString());
         if(notes.length > 0) {
            this.noteCurrent = 1;
            this.currentNote.set_text("1");
            this.entry.text = notes[0][1];
            this._text = this.entry.text;
         }
      } catch(e) {
         this.showErrorMessage(e.message);
      }
      return notes;
   },

   _onAddNote: function() {
      this.reset();
      this.noteCurrent = this.notesList.length + 1;
      this.currentNote.set_text(this.noteCurrent.toString());
   },

   _onRemoveNote: function() {
      try {
         if(this.notesList.length > 1) { 
            if((this.noteCurrent != 0)&&(this.noteCurrent <= this.notesList.length)) {
               if(this.deleteNote(this.noteCurrent - 1)) {
                  this.notesList.splice(this.noteCurrent - 1, 1);
                  this.numberNote.set_text(this.notesList.length.toString());
                  if(this.noteCurrent > this.notesList.length) {
                     this.noteCurrent = this.notesList.length;
                     this.currentNote.set_text(this.noteCurrent.toString());
                     this.entry.text = this.notesList[this.noteCurrent - 1][1];
                  } else
                     this.entry.text = this.notesList[this.noteCurrent][1];
               }
            } else if(this.noteCurrent == 0) {
               if(this.deleteNote(this.noteCurrent)) {
                  this.notesList.splice(this.noteCurrent, 1);
                  this.entry.text = this.notesList[this.noteCurrent][1];
                  this.numberNote.set_text(this.notesList.length.toString());
               }
            }
         } else if(this.notesList.length == 1) {
            if(this.deleteNote(0)) {
               this.noteCurrent = 1;
               this.notesList.splice(0, 1);
               this.numberNote.set_text("0");
               this.currentNote.set_text("1");
               this.reset();
            }
         }
        // this.showErrorMessage("noteCurrent: " + this.noteCurrent + " lengh:" + this.notesList.length);
      } catch(e) {
         this.showErrorMessage(e.message);
      }
   },

   _onBackNote: function() {
      if(this.notesList.length != 0) {
         if((this.noteCurrent == 0)||(this.noteCurrent == 1)) {
            this.noteCurrent = this.notesList.length;
            this.entry.text = this.notesList[this.noteCurrent - 1][1];
            this.currentNote.set_text(this.noteCurrent.toString());
         }
         else if(this.noteCurrent > 0) {
            this.noteCurrent--;
            this.entry.text = this.notesList[(this.noteCurrent - 1)][1];
            this.currentNote.set_text(this.noteCurrent.toString());
         }
      }
   },

   _onNextNote: function() {
      if(this.notesList.length != 0) {
         if(this.noteCurrent == 0) {
            if(this.notesList.length != 1) {
               this.noteCurrent = 2;
               this.entry.text = this.notesList[(this.noteCurrent - 1)][1];
               this.currentNote.set_text(this.noteCurrent.toString());
            }
         }
         else {
            if(this.noteCurrent < this.notesList.length) {
               this.entry.text = this.notesList[this.noteCurrent][1];
               this.currentNote.set_text((this.noteCurrent + 1).toString());
            } else {
               this.noteCurrent = 0;
               this.entry.text = this.notesList[this.noteCurrent][1];
               this.currentNote.set_text((this.noteCurrent + 1).toString());
            }
            this.noteCurrent++;
         }
      }
   },

   findNotesFromFile: function() {
      let notes = new Array();
      let notesFolder = Gio.file_new_for_path(GLib.get_home_dir() + "/.local/share/notes");
      if(!this._isDirectory(notesFolder)) {
         return notes;
      }
      let children = notesFolder.enumerate_children('standard::name,standard::type',
                                          Gio.FileQueryInfoFlags.NONE, null);
      let info, nameFile, lastIndex;
      while ((info = children.next_file(null)) != null) {
         if (info.get_file_type() == Gio.FileType.REGULAR) {
            nameFile = info.get_name();
            lastIndex = nameFile.lastIndexOf(".");
            if (nameFile.substring(lastIndex) == ".note") {
               notes.push([nameFile.substring(0, lastIndex), ""]);
            }
         }
      }
      return notes;
   },

   _isDirectory: function(fDir) {
      try {
         let info = fDir.query_filesystem_info("standard::type", null);
         if((info)&&(info.get_file_type() != Gio.FileType.DIRECTORY))
            return true;
      } catch(e) {
      }
      return false;
   },

   _makeDirectoy: function(fDir) {
      if(!this._isDirectory(fDir))
         this._makeDirectoy(fDir.get_parent());
      if(!this._isDirectory(fDir))
         fDir.make_directory(null);
   },

   setStyle: function() {
      let _color = (this._boxColor.replace(')',',' + this._transparency + ')')).replace('rgb','rgba');
      this.mainBox.set_style('padding: 4px; border: '+ this._borderBoxWidth + 'px solid ' + this._borderBoxColor +
                             '; background-color: ' + _color + '; border-radius: 12px; color: ' + this._fontColor +
                             '; text-shadow: 1px 1px 2px #000; font-weight: bold;');
      let fontTag = '';
      if((this._fontFamily)&&(this._fontFamily != ""))
         fontTag = 'font-family: ' + this._fontFamily + ';';
      this.entry.set_style('font-size: ' + this._textSize + 'pt; color: ' + this._fontColor + '; font-weight: normal; ' + fontTag);
   },

   fixWidth: function(fix) {
      this._fWidth = fix;
      if(fix)
         this.entry.set_width(this._width);
      else
         this.entry.set_width(-1);
   },
 
   on_desklet_removed: function() {
      this.reset();
      if(this.focusIDSignal > 0)
         this.clutterText.disconnect(this.focusIDSignal);
      this.focusIDSignal = 0;
      if(this.keyPressIDSignal == 0)
         this.clutterText.disconnect(this.keyPressIDSignal);
      this.keyPressIDSignal = 0;
   },

   reset: function () {
      this.entry.text = "";
      global.stage.set_key_focus(null);
   },

   _initDeskletContruction: function() {
      this.mainBox = new St.BoxLayout({vertical:true});
      let buttonBanner = new St.BoxLayout({vertical:false});
      let leftBox = new St.BoxLayout({vertical:false});
      let centerBox = new St.BoxLayout({vertical:false});
      let rightBox = new St.BoxLayout({vertical:false}); 
      let textBox = new St.BoxLayout({vertical:false});

      let addButton = this._buttonCreation('list-add', _("Add new Note"));
      addButton.connect('clicked', Lang.bind(this, this._onAddNote));
      leftBox.add(addButton, {x_fill: true, x_align: St.Align.END});

      this.currentNote = new St.Label();
      this.currentNote.set_text("1");

      this.numberNote = new St.Label();
      this.numberNote.set_text("0");

      let separator = new St.Label();
      separator.set_text("/");

      let backButton = this._buttonCreation('edit-undo', _("Back Note"));
      backButton.connect('clicked', Lang.bind(this, this._onBackNote));

      let nextButton = this._buttonCreation('edit-redo', _("Next Note"));
      nextButton.connect('clicked', Lang.bind(this, this._onNextNote));

      centerBox.add(backButton, {x_fill: true, x_align: St.Align.MIDDLE});
      centerBox.add(this.currentNote, {x_fill: true, x_align: St.Align.MIDDLE});
      centerBox.add(separator, {x_fill: true, x_align: St.Align.MIDDLE});
      centerBox.add(this.numberNote, {x_fill: true, x_align: St.Align.MIDDLE});
      centerBox.add(nextButton, {x_fill: true, x_align: St.Align.MIDDLE});      

      let deleteButton = this._buttonCreation('window-close', _("Remove Note"));
      deleteButton.connect('clicked', Lang.bind(this, this._onRemoveNote));
      
      rightBox.add(deleteButton, {x_fill: true, x_align: St.Align.END});

      buttonBanner.add(leftBox, {x_fill: true, x_align: St.Align.START});
      buttonBanner.add(centerBox, {x_fill: false, expand: true, x_align: St.Align.MIDDLE});
      buttonBanner.add(rightBox, {x_fill: true, x_align: St.Align.END});

      this.entry = new St.Entry({ name: 'noteEntry', /*hint_text: _("Type to your note..."),*/ track_hover: false, can_focus: true });

      this.mainBox.add(buttonBanner, {x_fill: true, expand: true, x_align: St.Align.START});
      this.mainBox.add(this.entry, {x_fill: true, y_fill: true, x_align: St.Align.START});
      //this.mainBox.add(textBox, {x_fill: true, y_fill: true, x_align: St.Align.START});


      this.clutterText = this.entry.clutter_text;
      this.clutterText.set_single_line_mode(false);
      this.clutterText.set_activatable(false);
      this.clutterText.set_line_wrap(true);
      this.clutterText.set_line_wrap_mode(imports.gi.Pango.WrapMode.WORD_CHAR);
      this.clutterText.set_selected_text_color(new Clutter.Color({red : 0, blue : 155, green : 0, alpha : 255}));
/*      textBox.add(this.entry, {x_fill: true, y_fill: false, expand: true, x_align: St.Align.START, y_align: St.Align.START});
      
      this._scrollArea = new St.ScrollView({ name: 'note-scrollview', vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                                             hscrollbar_policy: Gtk.PolicyType.NEVER, style_class: 'vfade' });
      this._scrollArea.add_actor(this.entry);
      let scrollBox = new St.BoxLayout({vertical:false});
            scrollBox.set_height(50);
      textBox.add_actor(scrollBox, { expand: false, y_fill: false, x_align: St.Align.START, x_fill: true });
      textBox.add(this.entry, {x_fill: true, y_fill: false, expand: true, x_align: St.Align.START, y_align: St.Align.START});
      scrollBox.add_actor(this._scrollArea, { expand: false, y_fill: false, y_align: St.Align.START, x_fill: true });
      scrollBox.connect('scroll-event', Lang.bind(this, this._scrollFilter));
      this.enableScrolling(true);*/
   },

/*
   _scrollFilter: function(actor, event) {
      let direction = event.get_scroll_direction();
      if (direction == Clutter.ScrollDirection.UP)
         this._selectCategory(Math.max(this._currentCategory - 1, -1))
      else if (direction == Clutter.ScrollDirection.DOWN)
         this._selectCategory(Math.min(this._currentCategory + 1, this._sections.length - 1));
   },

    _createScrollArea: function() {
       this._table.add_style_class_name('multi-line-notification');
       this._scrollArea = new St.ScrollView({ name: 'notification-scrollview', vscrollbar_policy: this._scrollPolicy,
            hscrollbar_policy: Gtk.PolicyType.NEVER, style_class: 'vfade' });
       //this._table.add(this._scrollArea, { row: 1, col: 2 });
       //this._updateLastColumnSettings();
       this._contentArea = new St.BoxLayout({ name: 'notification-body', vertical: true });
       this._scrollArea.add_actor(this._contentArea);
       // If we know the notification will be expandable, we need to add
       // the banner text to the body as the first element.
      this._addBannerBody();
    },


   enableScrolling: function(enableScrolling) {
      this._scrollPolicy = enableScrolling ? Gtk.PolicyType.AUTOMATIC : Gtk.PolicyType.NEVER;
      if(this._scrollArea)
         this._scrollArea.vscrollbar_policy = Gtk.PolicyType.AUTOMATIC;
   },
*/
   _buttonCreation: function(icon, toolTip) {    
      let bttIcon = new St.Icon({ icon_name: icon,
	                          icon_type: St.IconType.SYMBOLIC,
				  style_class: 'popup-menu-icon' });
      let btt = new St.Button({ child: bttIcon });
      btt.connect('notify::hover', Lang.bind(this, function(actor) {
         if(actor.get_hover())
            global.set_cursor(Cinnamon.Cursor.POINTING_HAND);
         else
            global.unset_cursor();
      }));
      let bttTooltip = new Tooltips.Tooltip(btt, toolTip);
      return btt;
   },

   _onFocusOut: function(actor, event) {
       try {
         if(this.focusIDSignal > 0)
            this.clutterText.disconnect(this.focusIDSignal);
         this.focusIDSignal = 0;
         if(this.keyPressIDSignal == 0)
            this.clutterText.disconnect(this.keyPressIDSignal);
         this.keyPressIDSignal = 0;
         this.newNote(this.entry.text);
         this._text = this.entry.text;
      } catch(e) {
         this.showErrorMessage(e.message);
      }
   },

   _onButtonPress: function(actor, event) {
      try {
         if(this.focusIDSignal == 0)
            this.focusIDSignal = this.clutterText.connect('key-focus-out', Lang.bind(this, this._onFocusOut));
         if(this.keyPressIDSignal == 0)
            this.keyPressIDSignal = this.clutterText.connect('key-press-event', Lang.bind(this, this._onKeyPress));
         if (event.get_button() == 1) {
            this._menu.close();
            this.entry._menu.close();
            global.set_stage_input_mode(Cinnamon.StageInputMode.FOCUSED);
            global.set_stage_input_mode(Cinnamon.StageInputMode.NORMAL);
            
            this.fixWidth(this._fWidth);
         }
         else if (event.get_button() == 3) {
            this.entry._menu.open();
         }
      } catch(e) {
         this.showErrorMessage(e.message);
      }
   },

   _createMenu: function() {
      this.entry._menu = new _EntryMenu(this.entry);
      this.entry._menuManager = new PopupMenu.PopupMenuManager({ actor: this.entry });
      this.entry._menuManager.addMenu(this.entry._menu);
      //CinnamonEntry.addContextMenu(this.entry);
   },

   // the entry does not show the hint
   _isActivated: function() {
      return this.clutterText.text == this.entry.get_text();
   },

   _onKeyPress: function(entry, event) {
      let symbol = event.get_key_symbol();
      if(symbol == Clutter.Escape) {
         if(this._isActivated()) {
            this.reset();
            return true;
         }
      }
    /*  else if(symbol == Clutter.Paste) {
        this.entry.text = this.entry.text.replace(/.*\((.+)\)/, '$1');
        Main.notify(this.entry.text);
        return true;
      }*/
      return false;
    },

    _onStyleChange: function() {
       this.setStyle();
    },

    _onFixWidth: function() {
       this.fixWidth(this._fWidth);
    },

    _onTextSetting: function() {
       this.entry.text = this._text;
    },

    _initSettings: function() {
      try {
         this.settings = new Settings.DeskletSettings(this, this.metadata["uuid"], this.instance_id);
         //this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "text", "_text", this._onTextSetting, null);
         /*"text": {
      "type": "entry",
      "default": "",
      "description": "Text current note:",
      "tooltip": "The current note."
       },*/
         this.settings.bindProperty(Settings.BindingDirection.IN, "boxColor", "_boxColor", this._onStyleChange, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "fontColor", "_fontColor", this._onStyleChange, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "textSize", "_textSize", this._onStyleChange, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "fontFamily", "_fontFamily", this._onStyleChange, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "transparency", "_transparency", this._onStyleChange, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "borderBoxWidth", "_borderBoxWidth", this._onStyleChange, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "borderBoxColor", "_borderBoxColor", this._onStyleChange, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "fixWidth", "_fWidth", this._onFixWidth, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "width", "_width", this._onFixWidth, null);

         this._onStyleChange();
         this._onFixWidth();
      } catch (e) {
         this.showErrorMessage(e.message);
         global.logError(e);
      }
   }
};

function main(metadata, desklet_id) {
   let desklet = new MyDesklet(metadata, desklet_id);
   return desklet;
}
