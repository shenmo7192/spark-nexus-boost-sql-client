import Header from './Header'
import Sidebar from './Sidebar'
import ToastContainer from './ToastContainer'
import ConfirmDialog from './ConfirmDialog'

export default function Layout({ children }) {
  return (
    <div className="h-full flex flex-col bg-surface-50">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto p-5">
          {children}
        </main>
      </div>
      <ToastContainer />
      <ConfirmDialog />
    </div>
  )
}
