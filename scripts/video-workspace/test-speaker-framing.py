"""Run inside the video image: python3 /tests/test-speaker-framing.py."""
import importlib.util
import unittest
from pathlib import Path

policy = Path("/app/framing_policy.py")
if not policy.exists():
    policy = Path(__file__).resolve().parents[2] / "containers/video-preview/framing_policy.py"
spec = importlib.util.spec_from_file_location("speaker_framing", str(policy))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SpeakerFramingPolicyTest(unittest.TestCase):
    def setUp(self):
        self.two = [[[40, 80, 55, 60], [520, 80, 55, 60]]] * 10
        self.one = [[[300, 80, 55, 60]]] * 10

    def test_speaking_face_can_be_on_either_side(self):
        self.assertLess(module.select_crop(self.two, [.95, .05], 640, 360)["x"], .2)
        self.assertGreater(module.select_crop(self.two, [.05, .95], 640, 360)["x"], .8)

    def test_uncertain_overlap_and_missing_audio_stay_wide(self):
        for scores in ([], [.6, .1], [.95, .85]):
            self.assertIsNone(module.select_crop(self.two, scores, 640, 360))

    def test_single_listener_does_not_become_speaker(self):
        self.assertIsNone(module.select_crop(self.one, [.2], 640, 360))
        self.assertIsNotNone(module.select_crop(self.one, [.95], 640, 360))

    def test_cuts_motion_and_unsafe_crops_stay_wide(self):
        self.assertIsNone(module.select_crop([[], *self.two], [.95, .05], 640, 360))
        self.assertIsNone(module.select_crop([[[40, 80, 55, 60]], *self.one], [.95], 640, 360))
        self.assertLess(module.select_crop([[[100, 20, 230, 200]]] * 10, [.95], 640, 360)["zoom"], 1)
        self.assertIsNotNone(module.select_crop(self.one, [.95], 360, 640))

    def test_closeup_safety_region_survives_render_geometry(self):
        observations = [[[210, 45, 170, 150]], [[230, 48, 175, 148]]] * 5
        crop = module.select_crop(observations, [.95], 640, 360)
        self.assertLess(crop["zoom"], 1)
        scale = (1920/360) * crop["zoom"]
        left = -(640*scale-1080)*crop["x"]
        top = -(360*scale-1920)*crop["y"]
        for row in observations:
            x, y, w, h = row[0]
            self.assertGreaterEqual(max(0, x-w*.6)*scale + left, -1)
            self.assertLessEqual(min(640, x+w*1.6)*scale + left, 1081)
            self.assertGreaterEqual(max(0, y-h*.65)*scale + top, -1)
            self.assertLessEqual(min(360, y+h*2.5)*scale + top, 1921)

    def test_shot_scale_stays_constant_through_detection_noise(self):
        windows = [{"sourceMs": i*2000, "observations": [[[210+i, 45, 170+i%2*8, 150]]]*10,
                    "scores": [.95] if i%2 else []} for i in range(8)]
        points = module.stabilize_shot(windows, 640, 360)
        self.assertEqual(len(points), 1)
        self.assertEqual(points[0]["framingMode"], "fill")
        self.assertLess(points[0]["crop"]["zoom"], 1)

    def test_uncertainty_and_one_false_vote_do_not_switch_speaker(self):
        scores = [[], [.05, .95], [], [.95, .05], [.05, .95]]
        windows = [{"sourceMs": i*2000, "observations": self.two, "scores": s} for i, s in enumerate(scores)]
        points = module.stabilize_shot(windows, 640, 360)
        self.assertEqual(len(points), 1)
        self.assertGreater(points[0]["crop"]["x"], .8)

    def test_confirmed_handoff_and_separate_shots(self):
        windows = [{"sourceMs": i*2000, "observations": self.two, "scores": s}
                   for i, s in enumerate([[.05, .95], [.05, .95], [.95, .05], [.95, .05]])]
        points = module.stabilize_shot(windows, 640, 360)
        self.assertEqual([p["sourceMs"] for p in points], [0, 4000])
        self.assertLess(points[-1]["crop"]["x"], .2)
        uncertain = [{"sourceMs": 10000, "observations": self.two, "scores": []}]
        self.assertEqual(module.stabilize_shot(uncertain, 640, 360)[0]["framingMode"], "fit")

    def test_missed_second_face_does_not_mix_two_people_into_one_track(self):
        windows = [
            {"sourceMs": 0, "observations": [[[40, 80, 55, 60]]]*10, "scores": [.95]},
            {"sourceMs": 2000, "observations": self.two, "scores": [.05, .95]},
            {"sourceMs": 4000, "observations": [[[520, 80, 55, 60]]]*10, "scores": [.95]},
        ]
        points = module.stabilize_shot(windows, 640, 360)
        self.assertEqual(len(points), 1)
        self.assertGreater(points[0]["crop"]["x"], .8)

    def test_tracks_survive_missing_neighbor_without_swapping_identity(self):
        left, right = self.two[0]
        rows = [[left, right], [right], [left, right], [right], [left, right], [right]]
        tracks = module.link_face_tracks(rows)
        self.assertEqual(len(tracks), 2)
        self.assertTrue(all(b[0] == 520 for _, b in tracks[1]["samples"]))
        self.assertEqual(module.track_box_at(tracks[0], 5), left)

    def test_long_absence_and_distant_faces_are_not_joined(self):
        left, right = self.two[0]
        rows = [[left]]*3 + [[]]*7 + [[right]]*3
        tracks = module.link_face_tracks(rows)
        self.assertEqual(len(tracks), 2)
        self.assertIsNone(module.track_box_at(tracks[0], 30))

    def track_window(self, i, left_score, right_score):
        return {"sourceMs": i*2000, "tracks": [
            {"id": 0, "score": left_score, "boxes": [self.two[0][0]]},
            {"id": 1, "score": right_score, "boxes": [self.two[0][1]]}]}

    def test_independent_scores_backfill_opening_and_ignore_missing_neighbor(self):
        windows = [self.track_window(0, None, None), self.track_window(1, None, .95), self.track_window(2, .1, .96)]
        points = module.frame_track_windows(windows, 640, 360)
        self.assertEqual(len(points), 1)
        self.assertEqual(points[0]["sourceMs"], 0)
        self.assertGreater(points[0]["crop"]["x"], .8)

    def test_one_vote_and_overlap_do_not_force_a_two_person_crop(self):
        for scores in [[(.1, .95), (None, None)], [(.9, .95), (.85, .9)]]:
            points = module.frame_track_windows([self.track_window(i, *s) for i,s in enumerate(scores)], 640, 360)
            self.assertTrue(all(p["framingMode"] == "fit" for p in points))

    def test_confirmed_track_handoff_and_missing_subject(self):
        windows = [self.track_window(i, *s) for i,s in enumerate([(.1,.95),(.1,.95),(.95,.1),(.95,.1)])]
        points = module.frame_track_windows(windows, 640, 360)
        self.assertEqual([p["sourceMs"] for p in points], [0,4000])
        self.assertGreater(points[0]["crop"]["x"], .8)
        self.assertLess(points[1]["crop"]["x"], .2)
        windows[0]["tracks"] = []
        points = module.frame_track_windows(windows, 640, 360)
        self.assertEqual(points[0]["framingMode"], "fit")


if __name__ == "__main__":
    unittest.main()
