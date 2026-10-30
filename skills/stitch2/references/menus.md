# Menus and menu items: what a menu is, the size of a row, groups, submenus, keys

The rules and the numbers come from the APG (WAI-ARIA Authoring Practices: menu and menubar, menu button, disclosure navigation), Material 3 menus, Carbon's menu, Apple's HIG on menus and sidebars, and NN/g's menu
checklist. A menu is a list of places or commands that opens from something or stands in a column; an item is one row of it.

## What is a menu, and what is not

- **Links are not a menu role.** A list of links that opens from a button is a *disclosure*: a button with `aria-expanded`, a list of links, and Tab goes through them. The ARIA `menu` role promises the arrow keys, type-ahead
  and a roving focus of a desktop menu, and a screen reader switches to a mode for it; links in it fail those promises (APG, disclosure navigation: "does not use the menu role"). **(check: menu-role-links)**
- **Commands are a menu.** A list of actions (Rename, Archive, Delete) uses `role="menu"` with `menuitem`, `menuitemcheckbox` or `menuitemradio`. The button that opens it has `aria-haspopup="menu"` and `aria-expanded`. Focus goes to the first item
  when it opens; Up and Down move, Home and End jump, a printable key goes to the next item that begins with it, Escape closes and returns focus to the button, Tab leaves and closes (APG).
- **A choice is not a menu.** A list to choose one value from is a listbox or a select.

## The item

- **A row, not a button.** An item is as wide as its menu, with no border and no fill at rest; the pointer fills it (a step of the surface, Material's 8% layer), the press fills it a step more, and focus rings it inside (`outline-offset: -2px`).
  A row with a border is a button in a box, and a column of boxes reads as a stack of buttons, not as a list **(check: menu-item-boxed)**.
- **Size.** 48px high: 44px is the floor of a touch target (WCAG 2.5.8 asks 24, Apple 44pt, Google 48dp); Material's menu item is 48dp on a phone and 56dp with two lines; Carbon's large item is 48px. A row of 13px text in
  a 32px box is what a dense desktop menu has, and it is the wrong size for a menu that people also touch **(check: menu-item-size)**.
- **Text.** The body level (15/26, weight 400), in the strong colour: an item is read, so it is not smaller than the text and the fields beside it. A row with a second line sets its name on 20px (the field level) and says the line under it in the metadata size, muted.
- **Padding.** 16px at the sides, so the text of every row, the icon column and the title of the menu stand on the same lines. The menu's box has 4px around its rows, so the fill of a row has room.
- **Icons: all or none in a group** (HIG). An icon is 20px, in the muted colour; an item without one in a group that has them leaves a gap that looks like a mistake **(check: menu-icons-uneven)**. An icon never stands in for the words.
- **Label.** A verb for a command (Rename), the name of the place for a link (Billing); sentence case in this product; an ellipsis (…) when the command asks for more before it runs; no article (HIG).
- **What is at the end of a row**: its value ("English"), a count, a mark that the link leaves the site, or a chevron when it opens a list. One mark, at the end, 16px.
- **The current item** is filled and has a bar at its start (3px), so it does not rest on colour alone (WCAG 1.4.1); `aria-current="page"` for a place, `aria-checked` with a check for a choice.
- **A disabled item** stays in the menu, dimmed, and stays focusable so a person can learn that it exists (APG, HIG); it says why where it can. It has `aria-disabled`, not `disabled`, so the key still reaches it.
- **A destructive item** has its own colour, stands in a group of its own and last (HIG, Material).

## Groups, order and length

- **Group related items and tell the groups apart by a separator** (a 1px rule with a margin), not by space alone; a group may have a name (12–13px, muted) when the menu is long. Most used first: people scan from the top (HIG).
- **Keep a menu short.** Up to about seven items in a group and one screen high; a longer list is divided, or its tail is a submenu. A list people made themselves (chats, views) may be long and scrolls.
- **Width.** 14rem at least, 20rem at most; a menu is as wide as its longest label and never narrower than the button that opened it by much.

## Submenus

- **One level, opened by a press, never by hover.** Hover is not on a touch screen, and a pointer that leaves the path closes it (NN/g: click-activated submenus, no cascading). The row has a chevron at its end, `aria-haspopup` and `aria-expanded`.
- **It takes the place of the list in the same box**, with a Back row on top that names where it returns to. Right Arrow or Enter opens it and puts focus on its first item; Left Arrow, Escape and Back return, with focus on the row that opened it. A submenu with more than about five items
  is a menu of its own (HIG). A submenu is not an indent of the same list (HIG).
- **The row stays available even when everything under it is not.**

## Where a menu is and what it covers

- **A menu opens next to what opened it**, below it or above when there is no room, and never past the window's edge (16px). In a column at the foot it opens upward; in a strip of icons, beside it. It is closed by Escape and by a press outside it.
- **A menu does not cover the screen on a large window** (NN/g); on a phone it may become a sheet.
- **Primary navigation in an app is a column on the left** (NN/g, expected locations); its current place is always marked (the commonest mistake of site menus is not saying where you are).

## What stitch2 checks

- **menu-item-size**: an item of a `menu` or a menu-like list is under 44px high, or its text is under 14px.
- **menu-item-boxed**: an item has a border drawn.
- **menu-role-links**: a `role="menu"` whose items are all links, which is a disclosure.
- **menu-icons-uneven**: some items of a group have an icon and others do not.

