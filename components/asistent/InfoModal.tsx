'use client';

import {
  Sparkle,
  CalendarBlank,
  Users,
  Briefcase,
  TrendUp,
  Lightbulb,
} from '@phosphor-icons/react';

interface InfoModalProps {
  onClose: () => void;
}

export function InfoModal({ onClose }: InfoModalProps) {
  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 pr-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-lg flex-shrink-0">
          <Sparkle className="w-5 h-5 text-white" weight="fill" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">O asistentu</h2>
          <p className="text-xs text-gray-500">Vaš AI pomočnik za poslovanje</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* What can it do */}
        <div>
          <h4 className="font-semibold text-sm text-gray-900 mb-2">Kaj lahko storim?</h4>
          <ul className="text-sm text-gray-600 space-y-1.5">
            <li className="flex items-center gap-2">
              <CalendarBlank className="w-4 h-4 text-violet-500 flex-shrink-0" weight="fill" />
              <span>Pomagam pri upravljanju terminov</span>
            </li>
            <li className="flex items-center gap-2">
              <Users className="w-4 h-4 text-violet-500 flex-shrink-0" weight="fill" />
              <span>Ustvarim nove stranke</span>
            </li>
            <li className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-violet-500 flex-shrink-0" weight="fill" />
              <span>Odgovorim na vprašanja o podjetju</span>
            </li>
            <li className="flex items-center gap-2">
              <TrendUp className="w-4 h-4 text-violet-500 flex-shrink-0" weight="fill" />
              <span>Pomagam pri analizi podatkov</span>
            </li>
          </ul>
        </div>

        {/* How to use */}
        <div>
          <h4 className="font-semibold text-sm text-gray-900 mb-2">Kako me uporabljati?</h4>
          <p className="text-sm text-gray-600">
            Preprosto mi zastavite vprašanje ali ukaz v naravnem jeziku.
            Razumem slovenščino in vam bom pomagal pri vsakodnevnih nalogah.
          </p>
        </div>

        {/* Example queries */}
        <div>
          <h4 className="font-semibold text-sm text-gray-900 mb-2">Primeri vprašanj</h4>
          <div className="flex flex-wrap gap-1.5">
            <ExampleChip query="Termini danes" />
            <ExampleChip query="Najdi stranko Ana" />
            <ExampleChip query="Koliko strank imam?" />
            <ExampleChip query="Statistike" />
          </div>
        </div>

        {/* Tips */}
        <div className="p-3 bg-gradient-to-br from-violet-50 to-cyan-50 rounded-xl border border-violet-200">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-violet-600" weight="fill" />
            <h4 className="font-semibold text-sm text-violet-900">Nasveti</h4>
          </div>
          <ul className="text-xs text-violet-800 space-y-1">
            <li>• Bodite specifični za boljše rezultate</li>
            <li>• Uporabite hitre odgovore pod sporočili</li>
            <li>• Zgodovina se shrani za kasnejši pregled</li>
          </ul>
        </div>

        {/* Beta notice */}
        <div className="text-center text-xs text-gray-500 pt-1">
          <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-gradient-to-r from-violet-500 to-cyan-500 text-white rounded-full mr-1.5">
            BETA
          </span>
          Vaše povratne informacije so dobrodošle!
        </div>
      </div>
    </div>
  );
}

function ExampleChip({ query }: { query: string }) {
  return (
    <span className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 hover:border-violet-300 hover:bg-violet-50 transition-colors cursor-default">
      {query}
    </span>
  );
}
