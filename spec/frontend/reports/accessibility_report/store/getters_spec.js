import * as getters from '~/reports/accessibility_report/store/getters';
import createStore from '~/reports/accessibility_report/store';
import { LOADING, ERROR, SUCCESS, STATUS_FAILED } from '~/reports/constants';

describe('Accessibility reports store getters', () => {
  let localState;
  let localStore;

  beforeEach(() => {
    localStore = createStore();
    localState = localStore.state;
  });

  describe('summaryStatus', () => {
    describe('when summary is loading', () => {
      it('returns loading status', () => {
        localState.isLoading = true;

        expect(getters.summaryStatus(localState)).toEqual(LOADING);
      });
    });

    describe('when summary has error', () => {
      it('returns error status', () => {
        localState.hasError = true;

        expect(getters.summaryStatus(localState)).toEqual(ERROR);
      });
    });

    describe('when summary has failed status', () => {
      it('returns loading status', () => {
        localState.status = STATUS_FAILED;

        expect(getters.summaryStatus(localState)).toEqual(ERROR);
      });
    });

    describe('when summary has successfully loaded', () => {
      it('returns loading status', () => {
        expect(getters.summaryStatus(localState)).toEqual(SUCCESS);
      });
    });
  });

  describe('groupedSummaryText', () => {
    describe('when state is loading', () => {
      it('returns the loading summary message', () => {
        localState.isLoading = true;
        const result = 'Accessibility scanning results are being parsed';

        expect(getters.groupedSummaryText(localState)).toEqual(result);
      });
    });

    describe('when state has error', () => {
      it('returns the error summary message', () => {
        localState.hasError = true;
        const result = 'Accessibility scanning failed loading results';

        expect(getters.groupedSummaryText(localState)).toEqual(result);
      });
    });

    describe('when state has successfully loaded', () => {
      describe('when report has errors', () => {
        it('returns summary message containing number of errors', () => {
          localState.report = {
            summary: {
              errors: 1,
              warnings: 1,
            },
          };
          const result = 'Accessibility scanning detected 2 issues for the source branch only';

          expect(getters.groupedSummaryText(localState)).toEqual(result);
        });
      });

      describe('when report has no errors', () => {
        it('returns summary message containing no errors', () => {
          localState.report = {
            summary: {
              errors: 0,
              warnings: 0,
            },
          };
          const result = 'Accessibility scanning detected no issues for the source branch only';

          expect(getters.groupedSummaryText(localState)).toEqual(result);
        });
      });
    });
  });

  describe('shouldRenderIssuesList', () => {
    describe('when has issues to render', () => {
      it('returns true', () => {
        localState.report = {
          existing_errors: [{ name: 'Issue' }],
        };

        expect(getters.shouldRenderIssuesList(localState)).toEqual(true);
      });
    });

    describe('when does not have issues to render', () => {
      it('returns false', () => {
        localState.report = {
          status: 'success',
          summary: { errors: 0, warnings: 0 },
        };

        expect(getters.shouldRenderIssuesList(localState)).toEqual(false);
      });
    });
  });

  describe('unresolvedIssues', () => {
    it('returns concatenated array of unresolved errors, warnings, and notes', () => {
      localState.report = {
        existing_errors: [1],
        existing_warnings: [2],
        existing_notes: [3],
      };
      const result = [1, 2, 3];

      expect(getters.unresolvedIssues(localState)).toEqual(result);
    });
  });

  describe('resolvedIssues', () => {
    it('returns concatenated array of resolved errors, warnings, and notes', () => {
      localState.report = {
        resolved_errors: [1],
        resolved_warnings: [2],
        resolved_notes: [3],
      };
      const result = [1, 2, 3];

      expect(getters.resolvedIssues(localState)).toEqual(result);
    });
  });

  describe('newIssues', () => {
    it('returns concatenated array of new errors, warnings, and notes', () => {
      localState.report = {
        new_errors: [1],
        new_warnings: [2],
        new_notes: [3],
      };
      const result = [1, 2, 3];

      expect(getters.newIssues(localState)).toEqual(result);
    });
  });
});
