const fs = require('fs');

let html = fs.readFileSync('org_chart.html', 'utf8');

// Update renderHierarchyPoster:
// In members list for each card: include both primary members AND concurrent members!
const targetMemberFilter = `        const rawMembers = Array.from(memberMap.values());
        const members = rawMembers.filter(e => {
          if (isUnassigned(e)) return false;
          const eid = String(e.id || e.code);
          if (placedEmployeeIds.has(eid)) return false;
          return true;
        });

        // Register all members placed in this card so they won't appear in subsequent cards
        members.forEach(markPlaced);`;

const replacementMemberFilter = `        // รวมบุคลากรที่ดำรงตำแหน่งควบในแผนกนี้ด้วย
        list.forEach(emp => {
          if (isUnassigned(emp)) return false;
          const concList = Array.isArray(emp.concurrentPositions) ? emp.concurrentPositions : [];
          const hasConcHere = concList.some(c => 
            (nodeId && c.departmentNodeId === nodeId) || 
            (c.department === deptName || c.department === title || (c.department && c.department.includes(deptName)))
          );
          if (hasConcHere) {
            const copyForConc = { ...emp, isConcurrentInThisDept: true };
            memberMap.set(String(emp.id || emp.code) + '_conc_' + (nodeId || deptName), copyForConc);
          }
        });

        const rawMembers = Array.from(memberMap.values());
        const members = rawMembers.filter(e => {
          if (isUnassigned(e)) return false;
          if (e.isConcurrentInThisDept) return true; // ตำแหน่งควบสามารถแสดงในแผนกนี้ได้เสมอ
          const eid = String(e.id || e.code);
          if (placedEmployeeIds.has(eid)) return false;
          return true;
        });

        // Register only primary members placed so they won't appear as primary in subsequent cards
        members.filter(m => !m.isConcurrentInThisDept).forEach(markPlaced);`;

if (!html.includes(targetMemberFilter)) {
  console.error("targetMemberFilter not found");
  process.exit(1);
}
html = html.replace(targetMemberFilter, replacementMemberFilter);
console.log("1. Updated member filter to include concurrent members in department card");

// Update avatar item badge rendering in department cards:
const targetAvatarRender = `                <div class="avatar-circle-ph has-emp">
                  \${photoUrl ? \`<img src="\${photoUrl}" alt="\${safeName}" onerror="this.parentElement.innerHTML='<i class=\\\\'bi bi-person-fill text-primary\\\\'></i>'" />\` : \`<i class="bi bi-person-fill text-primary"></i>\`}
                </div>`;

const replacementAvatarRender = `                <div class="avatar-circle-ph has-emp position-relative">
                  \${photoUrl ? \`<img src="\${photoUrl}" alt="\${safeName}" onerror="this.parentElement.innerHTML='<i class=\\\\'bi bi-person-fill text-primary\\\\'></i>'" />\` : \`<i class="bi bi-person-fill text-primary"></i>\`}
                  \${emp.isConcurrentInThisDept ? \`<span class="position-absolute top-0 end-0 badge bg-warning text-dark border border-white p-0.5 rounded-circle fs-9" style="font-size: 7px; transform: translate(30%, -30%);" title="ดำรงตำแหน่งควบ/รักษาการ"><i class="bi bi-star-fill"></i></span>\` : ''}
                </div>`;

if (!html.includes(targetAvatarRender)) {
  console.error("targetAvatarRender not found");
  process.exit(1);
}
html = html.replace(targetAvatarRender, replacementAvatarRender);
console.log("2. Added visual badge for concurrent member avatar");

fs.writeFileSync('org_chart.html', html, 'utf8');
console.log("Successfully patched org_chart.html with concurrent avatar rendering!");
