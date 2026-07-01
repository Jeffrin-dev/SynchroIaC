import { getDashboardOrgContext } from '../../../../lib/dashboard-auth'

export default async function Page() {
  await getDashboardOrgContext()
  return <div>WIP</div>
}
