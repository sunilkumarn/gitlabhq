/* eslint-disable max-classes-per-file, one-var, consistent-return */

import $ from 'jquery';
import { escape } from 'lodash';
import fuzzaldrinPlus from 'fuzzaldrin-plus';
import axios from './lib/utils/axios_utils';
import { visitUrl } from './lib/utils/url_utility';
import { isObject } from './lib/utils/type_utility';
import renderItem from './gl_dropdown/render';

const BLUR_KEYCODES = [27, 40];

const HAS_VALUE_CLASS = 'has-value';

const LOADING_CLASS = 'is-loading';

const PAGE_TWO_CLASS = 'is-page-two';

const ACTIVE_CLASS = 'is-active';

const INDETERMINATE_CLASS = 'is-indeterminate';

let currentIndex = -1;

const NON_SELECTABLE_CLASSES = '.divider, .separator, .dropdown-header, .dropdown-menu-empty-item';

const SELECTABLE_CLASSES = `.dropdown-content li:not(${NON_SELECTABLE_CLASSES}, .option-hidden)`;

const CURSOR_SELECT_SCROLL_PADDING = 5;

const FILTER_INPUT = '.dropdown-input .dropdown-input-field:not(.dropdown-no-filter)';

const NO_FILTER_INPUT = '.dropdown-input .dropdown-input-field.dropdown-no-filter';

class GitLabDropdownInput {
  constructor(input, options) {
    this.input = input;
    this.options = options;
    this.fieldName = this.options.fieldName || 'field-name';
    const $inputContainer = this.input.parent();
    const $clearButton = $inputContainer.find('.js-dropdown-input-clear');
    $clearButton.on('click', e => {
      // Clear click
      e.preventDefault();
      e.stopPropagation();
      return this.input
        .val('')
        .trigger('input')
        .focus();
    });

    this.input
      .on('keydown', e => {
        const keyCode = e.which;
        if (keyCode === 13 && !options.elIsInput) {
          e.preventDefault();
        }
      })
      .on('input', e => {
        let val = e.currentTarget.value || this.options.inputFieldName;
        val = val
          .split(' ')
          .join('-') // replaces space with dash
          .replace(/[^a-zA-Z0-9 -]/g, '')
          .toLowerCase() // replace non alphanumeric
          .replace(/(-)\1+/g, '-'); // replace repeated dashes
        this.cb(this.options.fieldName, val, {}, true);
        this.input
          .closest('.dropdown')
          .find('.dropdown-toggle-text')
          .text(val);
      });
  }

  onInput(cb) {
    this.cb = cb;
  }
}

class GitLabDropdownFilter {
  constructor(input, options) {
    let ref, timeout;
    this.input = input;
    this.options = options;
    // eslint-disable-next-line no-cond-assign
    this.filterInputBlur = (ref = this.options.filterInputBlur) != null ? ref : true;
    const $inputContainer = this.input.parent();
    const $clearButton = $inputContainer.find('.js-dropdown-input-clear');
    $clearButton.on('click', e => {
      // Clear click
      e.preventDefault();
      e.stopPropagation();
      return this.input
        .val('')
        .trigger('input')
        .focus();
    });
    // Key events
    timeout = '';
    this.input
      .on('keydown', e => {
        const keyCode = e.which;
        if (keyCode === 13 && !options.elIsInput) {
          e.preventDefault();
        }
      })
      .on('input', () => {
        if (this.input.val() !== '' && !$inputContainer.hasClass(HAS_VALUE_CLASS)) {
          $inputContainer.addClass(HAS_VALUE_CLASS);
        } else if (this.input.val() === '' && $inputContainer.hasClass(HAS_VALUE_CLASS)) {
          $inputContainer.removeClass(HAS_VALUE_CLASS);
        }
        // Only filter asynchronously only if option remote is set
        if (this.options.remote) {
          clearTimeout(timeout);
          // eslint-disable-next-line no-return-assign
          return (timeout = setTimeout(() => {
            $inputContainer.parent().addClass('is-loading');

            return this.options.query(this.input.val(), data => {
              $inputContainer.parent().removeClass('is-loading');
              return this.options.callback(data);
            });
          }, 250));
        }
        return this.filter(this.input.val());
      });
  }

  static shouldBlur(keyCode) {
    return BLUR_KEYCODES.indexOf(keyCode) !== -1;
  }

  filter(searchText) {
    let group, results, tmp;
    if (this.options.onFilter) {
      this.options.onFilter(searchText);
    }
    const data = this.options.data();
    if (data != null && !this.options.filterByText) {
      results = data;
      if (searchText !== '') {
        // When data is an array of objects therefore [object Array] e.g.
        // [
        //   { prop: 'foo' },
        //   { prop: 'baz' }
        // ]
        if (Array.isArray(data)) {
          results = fuzzaldrinPlus.filter(data, searchText, {
            key: this.options.keys,
          });
        }
        // If data is grouped therefore an [object Object]. e.g.
        // {
        //   groupName1: [
        //     { prop: 'foo' },
        //     { prop: 'baz' }
        //   ],
        //   groupName2: [
        //     { prop: 'abc' },
        //     { prop: 'def' }
        //   ]
        // }
        else if (isObject(data)) {
          results = {};
          Object.keys(data).forEach(key => {
            group = data[key];
            tmp = fuzzaldrinPlus.filter(group, searchText, {
              key: this.options.keys,
            });
            if (tmp.length) {
              results[key] = tmp.map(item => item);
            }
          });
        }
      }
      return this.options.callback(results);
    }
    const elements = this.options.elements();
    if (searchText) {
      // eslint-disable-next-line func-names
      elements.each(function() {
        const $el = $(this);
        const matches = fuzzaldrinPlus.match($el.text().trim(), searchText);
        if (!$el.is('.dropdown-header')) {
          if (matches.length) {
            return $el.show().removeClass('option-hidden');
          }
          return $el.hide().addClass('option-hidden');
        }
      });
    } else {
      elements.show().removeClass('option-hidden');
    }

    elements
      .parent()
      .find('.dropdown-menu-empty-item')
      .toggleClass('hidden', elements.is(':visible'));
  }
}

class GitLabDropdownRemote {
  constructor(dataEndpoint, options) {
    this.dataEndpoint = dataEndpoint;
    this.options = options;
  }

  execute() {
    if (typeof this.dataEndpoint === 'string') {
      return this.fetchData();
    } else if (typeof this.dataEndpoint === 'function') {
      if (this.options.beforeSend) {
        this.options.beforeSend();
      }
      return this.dataEndpoint('', data => {
        // Fetch the data by calling the data function
        if (this.options.success) {
          this.options.success(data);
        }
        if (this.options.beforeSend) {
          return this.options.beforeSend();
        }
      });
    }
  }

  fetchData() {
    if (this.options.beforeSend) {
      this.options.beforeSend();
    }

    // Fetch the data through ajax if the data is a string
    return axios.get(this.dataEndpoint).then(({ data }) => {
      if (this.options.success) {
        return this.options.success(data);
      }
    });
  }
}

class GitLabDropdown {
  constructor(el1, options) {
    let selector, self;
    this.el = el1;
    this.options = options;
    this.updateLabel = this.updateLabel.bind(this);
    this.hidden = this.hidden.bind(this);
    this.opened = this.opened.bind(this);
    this.shouldPropagate = this.shouldPropagate.bind(this);
    self = this;
    selector = $(this.el).data('target');
    this.dropdown = selector != null ? $(selector) : $(this.el).parent();
    // Set Defaults
    this.filterInput = this.options.filterInput || this.getElement(FILTER_INPUT);
    this.noFilterInput = this.options.noFilterInput || this.getElement(NO_FILTER_INPUT);
    this.highlight = Boolean(this.options.highlight);
    this.icon = Boolean(this.options.icon);
    this.filterInputBlur =
      this.options.filterInputBlur != null ? this.options.filterInputBlur : true;
    // If no input is passed create a default one
    self = this;
    // If selector was passed
    if (typeof this.filterInput === 'string') {
      this.filterInput = this.getElement(this.filterInput);
    }
    const searchFields = this.options.search ? this.options.search.fields : [];
    if (this.options.data) {
      // If we provided data
      // data could be an array of objects or a group of arrays
      if (typeof this.options.data === 'object' && !(this.options.data instanceof Function)) {
        this.fullData = this.options.data;
        currentIndex = -1;
        this.parseData(this.options.data);
        this.focusTextInput();
      } else {
        this.remote = new GitLabDropdownRemote(this.options.data, {
          dataType: this.options.dataType,
          beforeSend: this.toggleLoading.bind(this),
          success: data => {
            this.fullData = data;
            this.parseData(this.fullData);
            this.focusTextInput();

            // Update dropdown position since remote data may have changed dropdown size
            this.dropdown.find('.dropdown-menu-toggle').dropdown('update');

            if (
              this.options.filterable &&
              this.filter &&
              this.filter.input &&
              this.filter.input.val() &&
              this.filter.input.val().trim() !== ''
            ) {
              return this.filter.input.trigger('input');
            }
          },
          instance: this,
        });
      }
    }
    if (this.noFilterInput.length) {
      this.plainInput = new GitLabDropdownInput(this.noFilterInput, this.options);
      this.plainInput.onInput(this.addInput.bind(this));
    }
    // Init filterable
    if (this.options.filterable) {
      this.filter = new GitLabDropdownFilter(this.filterInput, {
        elIsInput: $(this.el).is('input'),
        filterInputBlur: this.filterInputBlur,
        filterByText: this.options.filterByText,
        onFilter: this.options.onFilter,
        remote: this.options.filterRemote,
        query: this.options.data,
        keys: searchFields,
        instance: this,
        elements: () => {
          selector = `.dropdown-content li:not(${NON_SELECTABLE_CLASSES})`;
          if (this.dropdown.find('.dropdown-toggle-page').length) {
            selector = `.dropdown-page-one ${selector}`;
          }
          return $(selector, this.dropdown);
        },
        data: () => this.fullData,
        callback: data => {
          this.parseData(data);
          if (this.filterInput.val() !== '') {
            selector = SELECTABLE_CLASSES;
            if (this.dropdown.find('.dropdown-toggle-page').length) {
              selector = `.dropdown-page-one ${selector}`;
            }
            if ($(this.el).is('input')) {
              currentIndex = -1;
            } else {
              $(selector, this.dropdown)
                .first()
                .find('a')
                .addClass('is-focused');
              currentIndex = 0;
            }
          }
        },
      });
    }
    // Event listeners
    this.dropdown.on('shown.bs.dropdown', this.opened);
    this.dropdown.on('hidden.bs.dropdown', this.hidden);
    $(this.el).on('update.label', this.updateLabel);
    this.dropdown.on('click', '.dropdown-menu, .dropdown-menu-close', this.shouldPropagate);
    this.dropdown.on('keyup', e => {
      // Escape key
      if (e.which === 27) {
        return $('.dropdown-menu-close', this.dropdown).trigger('click');
      }
    });
    this.dropdown.on('blur', 'a', e => {
      let $dropdownMenu, $relatedTarget;
      if (e.relatedTarget != null) {
        $relatedTarget = $(e.relatedTarget);
        $dropdownMenu = $relatedTarget.closest('.dropdown-menu');
        if ($dropdownMenu.length === 0) {
          return this.dropdown.removeClass('show');
        }
      }
    });
    if (this.dropdown.find('.dropdown-toggle-page').length) {
      this.dropdown.find('.dropdown-toggle-page, .dropdown-menu-back').on('click', e => {
        e.preventDefault();
        e.stopPropagation();
        return this.togglePage();
      });
    }
    if (this.options.selectable) {
      selector = '.dropdown-content a';
      if (this.dropdown.find('.dropdown-toggle-page').length) {
        selector = '.dropdown-page-one .dropdown-content a';
      }
      this.dropdown.on('click', selector, e => {
        const $el = $(e.currentTarget);
        const selected = self.rowClicked($el);
        const selectedObj = selected ? selected[0] : null;
        const isMarking = selected ? selected[1] : null;
        if (this.options.clicked) {
          this.options.clicked.call(this, {
            selectedObj,
            $el,
            e,
            isMarking,
          });
        }

        // Update label right after all modifications in dropdown has been done
        if (this.options.toggleLabel) {
          this.updateLabel(selectedObj, $el, this);
        }

        $el.trigger('blur');
      });
    }
  }

  // Finds an element inside wrapper element
  getElement(selector) {
    return this.dropdown.find(selector);
  }

  toggleLoading() {
    return $('.dropdown-menu', this.dropdown).toggleClass(LOADING_CLASS);
  }

  togglePage() {
    const menu = $('.dropdown-menu', this.dropdown);
    if (menu.hasClass(PAGE_TWO_CLASS)) {
      if (this.remote) {
        this.remote.execute();
      }
    }
    menu.toggleClass(PAGE_TWO_CLASS);
    // Focus first visible input on active page
    return this.dropdown.find('[class^="dropdown-page-"]:visible :text:visible:first').focus();
  }

  parseData(data) {
    let groupData, html;
    this.renderedData = data;
    if (this.options.filterable && data.length === 0) {
      // render no matching results
      html = [this.noResults()];
    }
    // Handle array groups
    else if (isObject(data)) {
      html = [];

      Object.keys(data).forEach(name => {
        groupData = data[name];
        html.push(
          this.renderItem(
            {
              content: name,
              type: 'header',
            },
            name,
          ),
        );
        this.renderData(groupData, name).map(item => html.push(item));
      });
    } else {
      // Render each row
      html = this.renderData(data);
    }
    // Render the full menu
    const fullHtml = this.renderMenu(html);
    return this.appendMenu(fullHtml);
  }

  renderData(data, group) {
    return data.map((obj, index) => this.renderItem(obj, group || false, index));
  }

  shouldPropagate(e) {
    let $target;
    if (this.options.multiSelect || this.options.shouldPropagate === false) {
      $target = $(e.target);
      if (
        $target &&
        !$target.hasClass('dropdown-menu-close') &&
        !$target.hasClass('dropdown-menu-close-icon') &&
        !$target.data('isLink')
      ) {
        e.stopPropagation();

        // This prevents automatic scrolling to the top
        if ($target.closest('a').length) {
          return false;
        }
      }

      return true;
    }
  }

  filteredFullData() {
    return this.fullData.filter(
      r =>
        typeof r === 'object' &&
        !Object.prototype.hasOwnProperty.call(r, 'beforeDivider') &&
        !Object.prototype.hasOwnProperty.call(r, 'header'),
    );
  }

  opened(e) {
    this.resetRows();
    this.addArrowKeyEvent();

    const dropdownToggle = this.dropdown.find('.dropdown-menu-toggle');
    const hasFilterBulkUpdate = dropdownToggle.hasClass('js-filter-bulk-update');
    const shouldRefreshOnOpen = dropdownToggle.hasClass('js-gl-dropdown-refresh-on-open');
    const hasMultiSelect = dropdownToggle.hasClass('js-multiselect');

    // Makes indeterminate items effective
    if (this.fullData && (shouldRefreshOnOpen || hasFilterBulkUpdate)) {
      this.parseData(this.fullData);
    }

    // Process the data to make sure rendered data
    // matches the correct layout
    const inputValue = this.filterInput.val();
    if (this.fullData && hasMultiSelect && this.options.processData && inputValue.length === 0) {
      this.options.processData.call(
        this.options,
        inputValue,
        this.filteredFullData(),
        this.parseData.bind(this),
      );
    }

    const contentHtml = $('.dropdown-content', this.dropdown).html();
    if (this.remote && contentHtml === '') {
      this.remote.execute();
    } else {
      this.focusTextInput();
    }

    if (this.options.showMenuAbove) {
      this.positionMenuAbove();
    }

    if (this.options.opened) {
      if (this.options.preserveContext) {
        this.options.opened(e);
      } else {
        this.options.opened.call(this, e);
      }
    }

    return this.dropdown.trigger('shown.gl.dropdown');
  }

  positionMenuAbove() {
    const $menu = this.dropdown.find('.dropdown-menu');

    $menu.addClass('dropdown-open-top');
    $menu.css('top', 'initial');
    $menu.css('bottom', '100%');
  }

  hidden(e) {
    this.resetRows();
    this.removeArrowKeyEvent();
    const $input = this.dropdown.find('.dropdown-input-field');
    if (this.options.filterable) {
      $input.blur();
    }
    if (this.dropdown.find('.dropdown-toggle-page').length) {
      $('.dropdown-menu', this.dropdown).removeClass(PAGE_TWO_CLASS);
    }
    if (this.options.hidden) {
      this.options.hidden.call(this, e);
    }
    return this.dropdown.trigger('hidden.gl.dropdown');
  }

  // Render the full menu
  renderMenu(html) {
    if (this.options.renderMenu) {
      return this.options.renderMenu(html);
    }
    return $('<ul>').append(html);
  }

  // Append the menu into the dropdown
  appendMenu(html) {
    return this.clearMenu().append(html);
  }

  clearMenu() {
    let selector = '.dropdown-content';
    if (this.dropdown.find('.dropdown-toggle-page').length) {
      if (this.options.containerSelector) {
        selector = this.options.containerSelector;
      } else {
        selector = '.dropdown-page-one .dropdown-content';
      }
    }

    return $(selector, this.dropdown).empty();
  }

  renderItem(data, group, index) {
    let parent;

    if (this.dropdown && this.dropdown[0]) {
      parent = this.dropdown[0].parentNode;
    }

    return renderItem({
      instance: this,
      options: {
        ...this.options,
        icon: this.icon,
        highlight: this.highlight,
        highlightText: text => this.highlightTextMatches(text, this.filterInput.val()),
        highlightTemplate: this.highlightTemplate.bind(this),
        parent,
      },
      data,
      group,
      index,
    });
  }

  // eslint-disable-next-line class-methods-use-this
  highlightTemplate(text, template) {
    return `"<b>${escape(text)}</b>" ${template}`;
  }

  // eslint-disable-next-line class-methods-use-this
  highlightTextMatches(text, term) {
    const occurrences = fuzzaldrinPlus.match(text, term);
    const { indexOf } = [];

    return text
      .split('')
      .map((character, i) => {
        if (indexOf.call(occurrences, i) !== -1) {
          return `<b>${character}</b>`;
        }
        return character;
      })
      .join('');
  }

  // eslint-disable-next-line class-methods-use-this
  noResults() {
    return '<li class="dropdown-menu-empty-item"><a>No matching results</a></li>';
  }

  rowClicked(el) {
    let field, groupName, selectedIndex, selectedObject, isMarking;
    const { fieldName } = this.options;
    const isInput = $(this.el).is('input');
    if (this.renderedData) {
      groupName = el.data('group');
      if (groupName) {
        selectedIndex = el.data('index');
        selectedObject = this.renderedData[groupName][selectedIndex];
      } else {
        selectedIndex = el.closest('li').index();
        this.selectedIndex = selectedIndex;
        selectedObject = this.renderedData[selectedIndex];
      }
    }

    if (this.options.vue) {
      if (el.hasClass(ACTIVE_CLASS)) {
        el.removeClass(ACTIVE_CLASS);
      } else {
        el.addClass(ACTIVE_CLASS);
      }

      return [selectedObject];
    }

    field = [];
    const value = this.options.id ? this.options.id(selectedObject, el) : selectedObject.id;
    if (isInput) {
      field = $(this.el);
    } else if (value != null) {
      field = this.dropdown
        .parent()
        .find(`input[name='${fieldName}'][value='${value.toString().replace(/'/g, "\\'")}']`);
    }

    if (this.options.isSelectable && !this.options.isSelectable(selectedObject, el)) {
      return [selectedObject];
    }

    if (el.hasClass(ACTIVE_CLASS) && value !== 0) {
      isMarking = false;
      el.removeClass(ACTIVE_CLASS);
      if (field && field.length) {
        this.clearField(field, isInput);
      }
    } else if (el.hasClass(INDETERMINATE_CLASS)) {
      isMarking = true;
      el.addClass(ACTIVE_CLASS);
      el.removeClass(INDETERMINATE_CLASS);
      if (field && field.length && value == null) {
        this.clearField(field, isInput);
      }
      if ((!field || !field.length) && fieldName) {
        this.addInput(fieldName, value, selectedObject);
      }
    } else {
      isMarking = true;
      if (!this.options.multiSelect || el.hasClass('dropdown-clear-active')) {
        this.dropdown.find(`.${ACTIVE_CLASS}`).removeClass(ACTIVE_CLASS);
        if (!isInput) {
          this.dropdown
            .parent()
            .find(`input[name='${fieldName}']`)
            .remove();
        }
      }
      if (field && field.length && value == null) {
        this.clearField(field, isInput);
      }
      // Toggle active class for the tick mark
      el.addClass(ACTIVE_CLASS);
      if (value != null) {
        if ((!field || !field.length) && fieldName) {
          this.addInput(fieldName, value, selectedObject);
        } else if (field && field.length) {
          field.val(value).trigger('change');
        }
      }
    }

    return [selectedObject, isMarking];
  }

  focusTextInput() {
    if (this.options.filterable) {
      const initialScrollTop = $(window).scrollTop();

      if (this.dropdown.is('.show') && !this.filterInput.is(':focus')) {
        this.filterInput.focus();
      }

      if ($(window).scrollTop() < initialScrollTop) {
        $(window).scrollTop(initialScrollTop);
      }
    }
  }

  addInput(fieldName, value, selectedObject, single) {
    // Create hidden input for form
    if (single) {
      $(`input[name="${fieldName}"]`).remove();
    }

    const $input = $('<input>')
      .attr('type', 'hidden')
      .attr('name', fieldName)
      .val(value);
    if (this.options.inputId != null) {
      $input.attr('id', this.options.inputId);
    }

    if (this.options.multiSelect) {
      Object.keys(selectedObject).forEach(attribute => {
        $input.attr(`data-${attribute}`, selectedObject[attribute]);
      });
    }

    if (this.options.inputMeta) {
      $input.attr('data-meta', selectedObject[this.options.inputMeta]);
    }

    this.dropdown.before($input).trigger('change');
  }

  selectRowAtIndex(index) {
    // If we pass an option index
    let selector;
    if (typeof index !== 'undefined') {
      selector = `${SELECTABLE_CLASSES}:eq(${index}) a`;
    } else {
      selector = '.dropdown-content .is-focused';
    }
    if (this.dropdown.find('.dropdown-toggle-page').length) {
      selector = `.dropdown-page-one ${selector}`;
    }
    // simulate a click on the first link
    const $el = $(selector, this.dropdown);
    if ($el.length) {
      const href = $el.attr('href');
      if (href && href !== '#') {
        visitUrl(href);
      } else {
        $el.trigger('click');
      }
    }
  }

  addArrowKeyEvent() {
    const ARROW_KEY_CODES = [38, 40];
    let selector = SELECTABLE_CLASSES;
    if (this.dropdown.find('.dropdown-toggle-page').length) {
      selector = `.dropdown-page-one ${selector}`;
    }
    return $('body').on('keydown', e => {
      let $listItems, PREV_INDEX;
      const currentKeyCode = e.which;
      if (ARROW_KEY_CODES.indexOf(currentKeyCode) !== -1) {
        e.preventDefault();
        e.stopImmediatePropagation();
        PREV_INDEX = currentIndex;
        $listItems = $(selector, this.dropdown);
        // if @options.filterable
        //   $input.blur()
        if (currentKeyCode === 40) {
          // Move down
          if (currentIndex < $listItems.length - 1) {
            currentIndex += 1;
          }
        } else if (currentKeyCode === 38) {
          // Move up
          if (currentIndex > 0) {
            currentIndex -= 1;
          }
        }
        if (currentIndex !== PREV_INDEX) {
          this.highlightRowAtIndex($listItems, currentIndex);
        }
        return false;
      }
      if (currentKeyCode === 13 && currentIndex !== -1) {
        e.preventDefault();
        this.selectRowAtIndex();
      }
    });
  }

  // eslint-disable-next-line class-methods-use-this
  removeArrowKeyEvent() {
    return $('body').off('keydown');
  }

  resetRows() {
    currentIndex = -1;
    $('.is-focused', this.dropdown).removeClass('is-focused');
  }

  highlightRowAtIndex($listItems, index) {
    if (!$listItems) {
      // eslint-disable-next-line no-param-reassign
      $listItems = $(SELECTABLE_CLASSES, this.dropdown);
    }

    // Remove the class for the previously focused row
    $('.is-focused', this.dropdown).removeClass('is-focused');
    // Update the class for the row at the specific index
    const $listItem = $listItems.eq(index);
    $listItem.find('a:first-child').addClass('is-focused');
    // Dropdown content scroll area
    const $dropdownContent = $listItem.closest('.dropdown-content');
    const dropdownScrollTop = $dropdownContent.scrollTop();
    const dropdownContentHeight = $dropdownContent.outerHeight();
    const dropdownContentTop = $dropdownContent.prop('offsetTop');
    const dropdownContentBottom = dropdownContentTop + dropdownContentHeight;
    // Get the offset bottom of the list item
    const listItemHeight = $listItem.outerHeight();
    const listItemTop = $listItem.prop('offsetTop');
    const listItemBottom = listItemTop + listItemHeight;
    if (!index) {
      // Scroll the dropdown content to the top
      $dropdownContent.scrollTop(0);
    } else if (index === $listItems.length - 1) {
      // Scroll the dropdown content to the bottom
      $dropdownContent.scrollTop($dropdownContent.prop('scrollHeight'));
    } else if (listItemBottom > dropdownContentBottom + dropdownScrollTop) {
      // Scroll the dropdown content down
      $dropdownContent.scrollTop(
        listItemBottom - dropdownContentBottom + CURSOR_SELECT_SCROLL_PADDING,
      );
    } else if (listItemTop < dropdownContentTop + dropdownScrollTop) {
      // Scroll the dropdown content up
      return $dropdownContent.scrollTop(
        listItemTop - dropdownContentTop - CURSOR_SELECT_SCROLL_PADDING,
      );
    }
  }

  updateLabel(selected = null, el = null, instance = null) {
    let toggleText = this.options.toggleLabel(selected, el, instance);
    if (this.options.updateLabel) {
      // Option to override the dropdown label text
      toggleText = this.options.updateLabel;
    }

    return $(this.el)
      .find('.dropdown-toggle-text')
      .text(toggleText);
  }

  // eslint-disable-next-line class-methods-use-this
  clearField(field, isInput) {
    return isInput ? field.val('') : field.remove();
  }
}

// eslint-disable-next-line func-names
$.fn.glDropdown = function(opts) {
  // eslint-disable-next-line func-names
  return this.each(function() {
    if (!$.data(this, 'glDropdown')) {
      return $.data(this, 'glDropdown', new GitLabDropdown(this, opts));
    }
  });
};
