
// Notes Cinnamon Desklet v0.1 - 6 November 2013

//This is a simple desklet to add notes in the desktop.
//This is only for experimental uses.
//Base on https://github.com/linuxmint/Cinnamon/pull/2119
//of dalcde https://github.com/dalcde
//
// Lester Carballo Pérez
// lestcape@gmail.com

const Gio = imports.gi.Gio;
const St = imports.gi.St;

const Desklet = imports.ui.desklet;

const Lang = imports.lang;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Main = imports.ui.main;
const Clutter = imports.gi.Clutter;
const Cinnamon = imports.gi.Cinnamon;
const Gtk = imports.gi.Gtk;
const Tooltips = imports.ui.tooltips;
//const Meta = imports.gi.Meta;

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
      this.noteCurrent = 0;
      this._boxColor = "#000000";
      this._transparency = 50;
      this._borderBoxWidth = 2;
      this._borderBoxColor = "#fff";
      this.fWidth = false;
      this._width = 120;
      this.active = false;
      this.eventButton = null;
      this.capturedEventId = 0;
      this.focusIDSignal = 0;
      try {
         this._initDeskletContruction();
         this._initConnectionSignal();
         
         this.notesList = this.readNotesFromFile();

         this.setStyle();
         //this.fixWidth(true);
         this._createMenu();

         this.setContent(this.mainBox);
      } catch(e) {
         this.showErrorMessage(e.message);
      }
      this._updateDate();
   },

   showErrorMessage: function(menssage) {
      this.unlock();
      Main.notifyError(_("Error"), menssage);
   },

   newNote: function(noteMessage) {
      if((noteMessage)&&(noteMessage != "")) {
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
            } catch(e) {
               this.showErrorMessage(e.message);
            }
         } else {
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
                  notes[pos][1] = data[0].toString();
               } catch(e) {
                  this.showErrorMessage(e.message);
               }
            } else
               this.showErrorMessage(e.message);
         }
         this.noteCurrent = 0;
         this.currentNote.set_text("0");
         this.numberNote.set_text(notes.length.toString());
         if(notes.length > 0) {
            this.noteCurrent = 1;
            this.currentNote.set_text("1");
            this.entry.text = notes[0][1];
         }
      } catch(e) {
         this.showErrorMessage(e.message);
      }
      return notes;
   },

   _onAddNote: function() {
      this.entry.text = "";
      this.noteCurrent = this.notesList.length + 1;
      this.currentNote.set_text(this.noteCurrent.toString());
   },

   _onCloseNote: function() {
      try {
         if(this.notesList.length != 0) { 
            if(this.noteCurrent < this.notesList.length) {
               this.deleteNote(this.noteCurrent - 1);
               this.entry.text = this.notesList[this.noteCurrent][1];
               this.notesList.splice(this.noteCurrent, 1);
               this.numberNote.set_text(this.notesList.length.toString());
            } else {
            
            }
            this.showErrorMessage("noteCurrent: " + this.noteCurrent + " lengh:" + this.notesList.length);
         }
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
      let _color = (this._boxColor.replace(")","," + this._transparency + ")")).replace('rgb','rgba');
      this.mainBox.set_style('padding: 4px; border:'+ this._borderBoxWidth +
                                 'px solid ' + this._borderBoxColor + '; background-color: ' +
                                  _color + '; border-radius: 12px;');
   },

   fixWidth: function(fix) {
      this.fWidth = fix;
      if(fix)
         this.entry.set_width(this._width);
      else
         this.entry.set_width(-1);
   },
 
   on_desklet_removed: function() {
      this.reset();
      if(this.timeout > 0)
         Mainloop.source_remove(this.timeout);
   },

   reset: function () {
      this.entry.text = '';
      this.unlock();
   },

   unlock: function () {
      try {
         if(this.capturedEventId > 0)
            global.stage.disconnect(this.capturedEventId);
         this.capturedEventId = 0;
         if(this.focusIDSignal > 0)
            global.stage.disconnect(this.focusIDSignal);
         this.focusIDSignal = 0;
         this.active = false;
         this.clutterText.set_selection(0, 0);
         this.clutterText.set_cursor_visible(true);
         global.stage.set_key_focus(null);
         global.set_stage_input_mode(Cinnamon.StageInputMode.NORMAL);
         this.eventButton = null;
         this.clutterText.set_editable(false);
         this.newNote(this.entry.text);
         //Meta.enable_unredirect_for_screen(global.screen);
      } catch(e) {
         this.showErrorMessage(e.message);
      }
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
      this.currentNote.style="font-size: " + 10 + "pt";
      this.currentNote.set_text("0");

      this.numberNote = new St.Label();
      this.numberNote.style="font-size: " + 10 + "pt";
      this.numberNote.set_text("0");

      let separator = new St.Label();
      separator.style="font-size: " + 10 + "pt";
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

      let closeButton = this._buttonCreation('window-close', _("Close Note"));
      closeButton.connect('clicked', Lang.bind(this, this._onCloseNote));
      
      rightBox.add(closeButton, {x_fill: true, x_align: St.Align.END});

      buttonBanner.add(leftBox, {x_fill: true, x_align: St.Align.START});
      buttonBanner.add(centerBox, {x_fill: false, expand: true, x_align: St.Align.MIDDLE});
      buttonBanner.add(rightBox, {x_fill: true, x_align: St.Align.END});

     // this.entry = new St.Entry({ name: 'noteEntry', hint_text: _("Type to your note..."), track_hover: false, can_focus: true });
      this.entry = new St.Entry({ name: 'noteEntry', hint_text: "", track_hover: false, can_focus: true });

      this.mainBox.add(buttonBanner, {x_fill: true, expand: true, x_align: St.Align.START});
      this.mainBox.add(textBox, {x_fill: true, y_fill: true, x_align: St.Align.START});

      this.clutterText = this.entry.clutter_text;
      this.clutterText.set_single_line_mode(false);
      this.clutterText.set_activatable(false);
      this.clutterText.set_line_wrap(true);
      this.clutterText.set_line_wrap_mode(imports.gi.Pango.WrapMode.WORD_CHAR);
      textBox.add(this.entry, {x_fill: true, y_fill: false, expand: true, x_align: St.Align.START, y_align: St.Align.START});
/*      
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

   _initConnectionSignal: function() {
      this.clutterText.connect('key-press-event', Lang.bind(this, this._onKeyPress));
      this.clutterText.connect('text-changed', Lang.bind(this, this._onTextChanged));

      this.clutterText.connect('button-press-event', Lang.bind(this, function(actor, event) {
         try {
            if(this.focusIDSignal > 0)
               global.stage.disconnect(this.focusIDSignal);
            else
               this.focusIDSignal = global.stage.connect('notify::key-focus', Lang.bind(this, this._onStageKeyFocusChanged));
            if(this.capturedEventId > 0)
               global.stage.disconnect(this.capturedEventId);
            else
               this.capturedEventId = global.stage.connect('captured-event', Lang.bind(this, this._onCapturedEvent));
            
            this.active = true;
            this.eventButton = event;
            if (this.eventButton.get_button() == 1) {
               global.set_stage_input_mode(Cinnamon.StageInputMode.FOCUSED);
               global.set_stage_input_mode(Cinnamon.StageInputMode.NORMAL);
               this.clutterText.set_cursor_visible(true);
               this.entry._menu.close();
               this.clutterText.set_editable(true);
               this.fixWidth(this.fWidth);
            }
            else if (this.eventButton.get_button() == 3) {
              // global.set_stage_input_mode(Cinnamon.StageInputMode.NORMAL);
               global.set_stage_input_mode(Cinnamon.StageInputMode.FULLSCREEN);
               this.entry._menu.open();
            }
         } catch(e) {
            this.showErrorMessage(e.message);
         }
      }));

       //this.focusIDSignal = this.clutterText.connect('activate', Lang.bind(this, this._onStageKeyFocusChanged));
       
       //this.focusIDSignal = global.stage.connect('notify::key-focus', Lang.bind(this, this._onStageKeyFocusChanged));
   },

   _onCapturedEvent: function(actor, event) {
      try {
         let source = event.get_source();
         if(!this.actor.contains(source)) {
            if(event.type() == Clutter.EventType.BUTTON_PRESS) {
               //if(!Main.layoutManager.keyboardBox.contains(source)) {
                  //this.newNote(this.entry.text);
                  //this.showErrorMessage("me fui");
               //}
            } else
               this.unlock();
         }// else
            //this.showErrorMessage("Sirve");
      } catch(e) {
         this.showErrorMessage(e.message);
      }
   },

   _updateDate: function(){
      //this.showErrorMessage("Fue focouse:" + global.stage.get_key_focus());
      this.timeout = Mainloop.timeout_add_seconds(1, Lang.bind(this, this._updateDate));	
   },

   _createMenu: function() {
      this.entry._menu = new _EntryMenu(this.entry);
      this.entry._menuManager = new PopupMenu.PopupMenuManager({ actor: this.entry });
      this.entry._menuManager.addMenu(this.entry._menu);
   },

   // the entry does not show the hint
   _isActivated: function() {
      return this.clutterText.text == this.entry.get_text();
   },

   _onStageKeyFocusChanged: function() {
      try {

         let focus = global.stage.get_key_focus();
         let appearFocused = this.entry.contains(focus);
            if((this.eventButton == null)||(this.eventButton.get_source() != this.clutterText)
               ||(this.eventButton.get_source() != this.clutterText) ||(!this.active)) {
               appearFocused = false;
            }
            this.clutterText.set_cursor_visible(appearFocused);
            if (appearFocused) {
               this.entry.add_style_pseudo_class('focus');
                                       //this.showErrorMessage("ganed");
            }
            else {
               this.entry.remove_style_pseudo_class('focus');
               //global.set_stage_input_mode(Cinnamon.StageInputMode.NORMAL);
               //global.set_stage_input_mode(Cinnamon.StageInputMode.FULLSCREEN);
               global.stage.set_key_focus(null);
               this.clutterText.set_selection(0, 0);
               this.clutterText.set_cursor_visible(true);
               //this.newNote(this.entry.text);
               this.unlock();
            }

      } catch(e) {
         this.showErrorMessage(e.message);
      }
   },

   _onTextChanged: function (se, prop) {
      try {
      } catch(e) {
         this.showErrorMessage(e.message);
      }
   },

   _onKeyPress: function(entry, event) {
      let symbol = event.get_key_symbol();
      if (symbol == Clutter.Escape) {
         if (this._isActivated()) {
            this.reset();
            return true;
         }
      }
      return false;
    }
};

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

      Main.uiGroup.add_actor(this.actor);
      this.actor.hide();
   },

   open: function() {
      this._updatePasteItem();
      this._updateCopyItem();

      let direction = Gtk.DirectionType.TAB_FORWARD;
      if (!this.actor.navigate_focus(null, direction, false))
         this.actor.grab_key_focus();

      PopupMenu.PopupMenu.prototype.open.call(this);
   },

   _updateCopyItem: function() {
      this.selection = this._entry.clutter_text.get_selection();
      this._copyItem.setSensitive(this.selection && this.selection != '');
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
    }
};

function main(metadata, desklet_id) {
   let desklet = new MyDesklet(metadata, desklet_id);
   return desklet;
}
