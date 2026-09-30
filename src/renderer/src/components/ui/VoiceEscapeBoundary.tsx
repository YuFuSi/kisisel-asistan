import { toggleVoiceSession, useVoice } from '../../lib/voiceClient'
import { useDismissLayer } from '../../lib/useDismissLayer'

// Ses altyazılarının her parçasında tüm App'i yeniden çizmeden katman önceliğini kaydeder.
// VoiceOverlay Claude'un alanı olduğu için onun mevcut dinleyicisine dokunulmaz.
function VoiceEscapeBoundary(): null {
  const voice = useVoice()
  useDismissLayer(voice.sessionActive, 40, toggleVoiceSession)
  return null
}

export default VoiceEscapeBoundary
