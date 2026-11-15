/*
 * The French Country Club — the site's fixed wording (menu names, section headings, buttons).
 * Each entry has its default text; the admin's "Menu & wording" tab can replace any of them.
 * Changes are saved in content/site.json under site.labels. Shared by index.html and admin.html.
 */
(function (global) {
  'use strict';

  var GROUPS = [
    { title: 'Menu', note: 'Category names in the menu are changed under Categories, in Site settings.', items: [
      ['navHome', 'Home', 'Home'],
      ['navGallery', 'Gallery', 'Gallery'],
      ['navAbout', 'About', 'About'],
      ['menuButton', 'Menu button on phones', 'Menu']
    ] },
    { title: 'Home page', items: [
      ['heroButton', 'Button on the big top story', 'Read the story'],
      ['latestTitle', 'Heading above the latest 3 stories', 'Latest from the club'],
      ['latestLink', 'Link beside it', 'All stories'],
      ['exploreTitle', 'Heading above the category tiles', 'Explore the club'],
      ['moreTitle', 'Heading above more stories', 'From the journal'],
      ['moreLink', 'Link beside it', 'More stories'],
      ['stripTitle', 'Heading above the photo strip', 'Seen in the countryside'],
      ['stripLink', 'Link beside it', 'The gallery'],
      ['noStories', 'Shown when there are no stories', 'No stories yet.']
    ] },
    { title: 'Journal pages', items: [
      ['journalKicker', 'Small label above a category name', 'The journal'],
      ['journalTitle', 'Title of the all-stories page', 'The journal'],
      ['journalIntro', 'Introduction on the all-stories page', 'Every story from the club, newest first.'],
      ['allStories', 'First filter button', 'All stories'],
      ['emptyCategory', 'Shown when a category has no stories', 'No stories here yet — check back soon.']
    ] },
    { title: 'Story pages', items: [
      ['byline', 'Before the author’s name', 'By'],
      ['minRead', 'After the reading time', 'min read'],
      ['shareLine', 'Line under each story', 'Have a story, a correction or a photograph to share?'],
      ['shareLink', 'Link at the end of that line', 'Write to the club'],
      ['prevStory', 'Previous-story link', 'Previous story'],
      ['nextStory', 'Next-story link', 'Next story'],
      ['relatedTitle', 'Heading above related stories', 'You may also enjoy']
    ] },
    { title: 'Gallery, About and Photo credits', note: 'The gallery introduction and the about page text are in Site settings.', items: [
      ['galleryTitle', 'Gallery page title', 'The gallery'],
      ['noPhotos', 'Shown when the gallery is empty', 'No photos yet.'],
      ['aboutKicker', 'Small label above the about title', 'About'],
      ['writeInTitle', 'Heading of the box at the end of About', 'Write in'],
      ['writeInText', 'Text in that box', 'Letters, photographs and stories from readers are always welcome.'],
      ['creditsTitle', 'Photo credits page title', 'Photo credits'],
      ['creditsIntro', 'Introduction on the credits page', 'With thanks to the photographers whose work appears in the journal.']
    ] },
    { title: 'Footer', items: [
      ['footerJournal', 'Heading of the category links', 'The journal'],
      ['footerContact', 'Heading of the contact links', 'Write to us'],
      ['footerAbout', 'About link', 'About the club'],
      ['footerCredits', 'Photo credits link', 'Photo credits'],
      ['footerAdmin', 'Admin link', 'Admin']
    ] },
    { title: 'Page not found and maintenance', items: [
      ['notFoundTitle', '“Page not found” title', 'Lost in the lanes'],
      ['notFoundText', '“Page not found” text', 'We couldn’t find that page. Perhaps it was moved, or is still being written.'],
      ['notFoundButton', 'Button back to the home page', 'Back to the club'],
      ['maintTitle', 'Maintenance notice title', 'Back very soon']
    ] }
  ];

  var DEFAULTS = {};
  GROUPS.forEach(function (g) { g.items.forEach(function (it) { DEFAULTS[it[0]] = it[2]; }); });

  // Returns a function t(key) giving the site's wording, falling back to the default.
  function make(custom) {
    custom = custom || {};
    return function (key) {
      var v = custom[key];
      return (typeof v === 'string' && v.trim()) ? v : (DEFAULTS[key] != null ? DEFAULTS[key] : key);
    };
  }

  global.FCCLabels = { GROUPS: GROUPS, DEFAULTS: DEFAULTS, make: make };
})(typeof window !== 'undefined' ? window : globalThis);
