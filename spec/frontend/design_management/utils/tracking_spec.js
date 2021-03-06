import { mockTracking } from 'helpers/tracking_helper';
import { trackDesignDetailView } from '~/design_management/utils/tracking';

function getTrackingSpy(key) {
  return mockTracking(key, undefined, jest.spyOn);
}

describe('Tracking Events', () => {
  describe('trackDesignDetailView', () => {
    const eventKey = 'projects:issues:design';
    const eventName = 'design_viewed';

    it('trackDesignDetailView fires a tracking event when called', () => {
      const trackingSpy = getTrackingSpy(eventKey);

      trackDesignDetailView();

      expect(trackingSpy).toHaveBeenCalledWith(
        eventKey,
        eventName,
        expect.objectContaining({
          label: eventName,
          value: {
            'internal-object-refrerer': '',
            'version-number': 1,
            'current-version': false,
          },
        }),
      );
    });

    it('trackDesignDetailView allows to customize the value payload', () => {
      const trackingSpy = getTrackingSpy(eventKey);

      trackDesignDetailView('from-a-test', 100, true);

      expect(trackingSpy).toHaveBeenCalledWith(
        eventKey,
        eventName,
        expect.objectContaining({
          label: eventName,
          value: {
            'internal-object-refrerer': 'from-a-test',
            'version-number': 100,
            'current-version': true,
          },
        }),
      );
    });
  });
});
