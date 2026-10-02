# State OSOW rules

The 50-state snapshot in `data/osow-regulations-2026-10-01.json` comes from the user's USA OSOW Regulations by State sheet. Numeric columns control pricing, including where prose differs, as requested. The sheet itself is unchanged. Imported source-agency and official-source claims are provenance, not independent verification. Missing source links remain missing.

The applied Supabase migration adds `state_transport_limits.regulations_v2`. Legacy columns remain intact so the old deployed application continues using its previous dataset until this application is deployed. Both browser and server fetch the versioned rules and use the shared `src/lib/osow.js` evaluator. Rows without versioned rules retain legacy behavior.

Legal limits trigger strictly above the numeric limit. Escort triggers retain the existing inclusive convention (at or above). Height-pole, length, and overhang escort triggers use the existing one-escort price; two-escort width triggers use the two-escort price. Affected states each add one general permit price, and the highest escort price applies once per trip. Company prices are unchanged. Free-text police, roadway, and additional-escort conditions never invent charges or automatically assert a police escort requirement.

Overall loaded vehicle length and load overhang are optional feet inputs. Blank means not assessed, while zero overhang means none. Omitted length/overhang checks are recorded in skippedChecks and do not force manager review. Missing required weight, width, height, or vehicle assumptions still require review. Loaded height includes configured deck clearance; gross weight includes vehicle weight and attachments. New rules replace the old Indiana-only hardcoded exception when a versioned row exists.

The regular calculator's trip breakdown shows each flagged state's reasons, escort triggers, roadway and police guidance, agency, date, and valid source link. Unflagged states do not show notes. The client portal receives only a presentation toggle for extra dimensions and continues showing only the total quote, with no pricing breakdown or dispatch notes.

Verification covers all 50 imported states, numeric-versus-prose conflicts, boundaries, length/overhang/height-pole triggers, pricing aggregation, missing measurements, state-specific notes, and client visibility. The database import is applied; application deployment is a separate step.
