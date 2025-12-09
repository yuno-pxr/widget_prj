import { useRive, Layout, Fit, Alignment } from '@rive-app/react-canvas';

interface RiveWaitingProps {
    className?: string;
}

export const RiveWaiting = ({ className = "" }: RiveWaitingProps) => {
    // Using a reliable public Rive file for testing.
    // Ideally, this should be a local asset or a specific loading animation.
    // 'vehicles.riv' is a common example, though not a spinner.
    // We will limit its size or use it as a placeholder.
    // TODO: Replace with a proper "Loading" animation URL or local file.
    const { RiveComponent } = useRive({
        src: 'https://cdn.rive.app/animations/vehicles.riv',
        stateMachines: "bumpy", // 'bumpy' is a state machine in vehicles.riv
        autoplay: true,
        layout: new Layout({
            fit: Fit.Cover,
            alignment: Alignment.Center,
        }),
    });

    return (
        <div className={`w-full h-full overflow-hidden ${className}`}>
            <RiveComponent />
        </div>
    );
};
